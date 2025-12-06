import axios from "axios";

export const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL,
  withCredentials: true,
});

export function setupApiInterceptors() {
  // ---------------------------
  // 🚀 Request Interceptor
  // ---------------------------
  api.interceptors.request.use((config) => {
    // Access Token 붙이기
    const loginInfo = JSON.parse(localStorage.getItem("loginInfo"));
    if (loginInfo?.accessToken) {
      config.headers.Authorization = `Bearer ${loginInfo.accessToken}`;
    }

    // CSRF Token 붙이기
    const csrf = document.cookie
      .split("; ")
      .find((row) => row.startsWith("XSRF-TOKEN="))
      ?.split("=")[1];

    if (csrf) config.headers["X-XSRF-TOKEN"] = csrf;

    return config;
  });

  // 동시 refresh 요청 제어
  let isRefreshing = false;
  let refreshSubscribers = [];

  const onRefreshed = (newAccessToken) => {
    refreshSubscribers.forEach((cb) => cb(newAccessToken));
    refreshSubscribers = [];
  };

  const addSubscriber = (cb) => {
    refreshSubscribers.push(cb);
  };

  // ---------------------------
  // 🚀 Response Interceptor
  // ---------------------------
  api.interceptors.response.use(
    (res) => res,
    async (error) => {
      const originalRequest = error.config;

      // 🔥 Access Token 만료 → refresh 시도
      if ([401, 403].includes(error.response?.status) && !originalRequest._retry) {
        originalRequest._retry = true;

        // 이미 refresh 중이면 큐에 대기
        if (isRefreshing) {
          return new Promise((resolve) => {
            addSubscriber((newAccessToken) => {
              originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
              resolve(api(originalRequest));
            });
          });
        }

        isRefreshing = true;

        try {
          // ❗ 여기 수정됨: config 제거 (withCredentials 넣지 않음)
          const refreshResponse = await api.post("/auth/refresh");

          const newAccessToken = refreshResponse.data.accessToken;

          if (!newAccessToken) throw new Error("No accessToken returned");

          // localStorage 업데이트
          const loginInfo = JSON.parse(localStorage.getItem("loginInfo")) || {};
          loginInfo.accessToken = newAccessToken;
          localStorage.setItem("loginInfo", JSON.stringify(loginInfo));

          // axios 기본 헤더 갱신 (중요)
          api.defaults.headers.common["Authorization"] = `Bearer ${newAccessToken}`;

          // refresh 대기 요청 모두 처리
          onRefreshed(newAccessToken);
          isRefreshing = false;

          // 실패했던 요청 재시도
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          return api(originalRequest);

        } catch (err) {
          console.error("❌ Refresh failed:", err);
          isRefreshing = false;

          // 강제 로그아웃 처리
          localStorage.removeItem("loginInfo");
          window.location.href = "/login";
          return Promise.reject(err);
        }
      }

      // 다른 에러 그대로 반환
      return Promise.reject(error);
    }
  );
}
