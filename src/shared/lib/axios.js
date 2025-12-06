import axios from "axios";

export const api = axios.create({
  baseURL: "/",
  withCredentials: true,
});

export function setupApiInterceptors() {
  // ====== 요청 인터셉터 ======
  api.interceptors.request.use((config) => {
    // JWT
    const loginInfo = JSON.parse(localStorage.getItem("loginInfo"));
    if (loginInfo?.accessToken) {
      config.headers.Authorization = `Bearer ${loginInfo.accessToken}`;
    }

    // CSRF 토큰 쿠키에서 읽기
    const csrf = document.cookie
      .split("; ")
      .find((row) => row.startsWith("XSRF-TOKEN="))
      ?.split("=")[1];

    if (csrf) config.headers["X-XSRF-TOKEN"] = csrf;

    return config;
  });

  let isRefreshing = false;
  let refreshSubscribers = [];

  // refresh 큐 처리
  const onRefreshed = (newAccessToken) => {
    refreshSubscribers.forEach((cb) => cb(newAccessToken));
    refreshSubscribers = [];
  };

  const addSubscriber = (cb) => {
    refreshSubscribers.push(cb);
  };

  // ====== 응답 인터셉터 ======
  api.interceptors.response.use(
    (res) => res,
    async (error) => {
      const originalRequest = error.config;

      // ====== 401 발생 시 Refresh 요청 ======
      if (error.response?.status === 401 && !originalRequest._retry) {
        originalRequest._retry = true;

        if (isRefreshing) {
          return new Promise((resolve) => {
            addSubscriber((newToken) => {
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
              resolve(api(originalRequest));
            });
          });
        }

        isRefreshing = true;

        try {
          // 🔥🔥🔥 여기서 CSRF 헤더를 반드시 수동으로 넣어준다
          const csrf = document.cookie
            .split("; ")
            .find((row) => row.startsWith("XSRF-TOKEN="))
            ?.split("=")[1];

          const refreshResponse = await api.post(
            "/auth/refresh",
            {},
            {
              withCredentials: true,
              headers: {
                "X-XSRF-TOKEN": csrf ?? "",
              },
            }
          );

          const newAccessToken = refreshResponse.data.accessToken;

          if (!newAccessToken) throw new Error("No accessToken returned");

          // localStorage에 AccessToken 저장
          const loginInfo = JSON.parse(localStorage.getItem("loginInfo")) || {};
          loginInfo.accessToken = newAccessToken;
          localStorage.setItem("loginInfo", JSON.stringify(loginInfo));

          // axios 기본값도 갱신
          api.defaults.headers.Authorization = `Bearer ${newAccessToken}`;

          // 큐 처리
          onRefreshed(newAccessToken);
          isRefreshing = false;

          // 원래 요청 재실행
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          return api(originalRequest);
        } catch (err) {
          console.error("❌ Refresh failed:", err);

          isRefreshing = false;

          // 로그인 정보 초기화
          localStorage.removeItem("loginInfo");

          window.location.href = "/login";
          return Promise.reject(err);
        }
      }

      return Promise.reject(error);
    }
  );
}
