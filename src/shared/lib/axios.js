// import axios from "axios";

// export const api = axios.create({
//   baseURL: process.env.REACT_APP_API_URL,
//   withCredentials: true
// });

// export function setupApiInterceptors() {

//   api.interceptors.request.use((config) => {
//     const loginInfo = JSON.parse(localStorage.getItem("loginInfo"));
//     if (loginInfo?.accessToken) {
//       config.headers.Authorization = `Bearer ${loginInfo.accessToken}`;
//     }

//     const csrf = document.cookie
//       .split("; ")
//       .find((row) => row.startsWith("XSRF-TOKEN="))
//       ?.split("=")[1];

//     if (csrf) config.headers["X-XSRF-TOKEN"] = csrf;

//     return config;
//   });

//   let isRefreshing = false;
//   let refreshSubscribers = [];

//   const onRefreshed = (token) => {
//     refreshSubscribers.forEach((cb) => cb(token));
//     refreshSubscribers = [];
//   };

//   const addSubscriber = (cb) => {
//     refreshSubscribers.push(cb);
//   };

//   api.interceptors.response.use(
//     (res) => res,
//     async (error) => {
//       const originalRequest = error.config;

//       if ([401, 403].includes(error.response?.status) && !originalRequest._retry) {
//         originalRequest._retry = true;

//         if (isRefreshing) {
//           return new Promise((resolve) => {
//             addSubscriber((newAccessToken) => {
//               originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
//               resolve(api(originalRequest));
//             });
//           });
//         }

//         isRefreshing = true;

//         try {
//           const refreshResponse = await api.post("/auth/refresh");
//           const newAccessToken = refreshResponse.data.accessToken;

//           const loginInfo = JSON.parse(localStorage.getItem("loginInfo")) || {};
//           loginInfo.accessToken = newAccessToken;
//           localStorage.setItem("loginInfo", JSON.stringify(loginInfo));

//           api.defaults.headers.common["Authorization"] = `Bearer ${newAccessToken}`;

//           onRefreshed(newAccessToken);
//           isRefreshing = false;

//           originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
//           return api(originalRequest);

//         } catch (err) {
//           console.error("❌ Refresh failed:", err);

//           // CSRF 쿠키 제거 (중요)
//           document.cookie = "XSRF-TOKEN=; Max-Age=0; path=/; SameSite=None; Secure";

//           isRefreshing = false;
//           localStorage.removeItem("loginInfo");
//           window.location.href = "/login";
//           return Promise.reject(err);
//         }
//       }

//       return Promise.reject(error);
//     }
//   );
// }
import axios from "axios";

export const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL,
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

    // CSRF (localStorage에서 꺼내기)
    const csrf = localStorage.getItem("XSRF-TOKEN");
    if (csrf) {
      config.headers["X-XSRF-TOKEN"] = csrf;
    }

    return config;
  });

  // ====== 응답 인터셉터 ======
  api.interceptors.response.use(
    (response) => {
      // ★ 응답 헤더에서 XSRF-TOKEN 받으면 localStorage에 저장
      const newCsrf = response.headers["x-xsrf-token"];
      if (newCsrf) {
        localStorage.setItem("XSRF-TOKEN", newCsrf);
      }

      return response;
    },
    async (error) => {
      const originalRequest = error.config;

      // ============ REFRESH TOKEN 로직 ============
      if ([401, 403].includes(error.response?.status) && !originalRequest._retry) {
        originalRequest._retry = true;

        try {
          const refreshResponse = await api.post("/auth/refresh");

          const newAccessToken = refreshResponse.data.accessToken;

          const loginInfo = JSON.parse(localStorage.getItem("loginInfo")) || {};
          loginInfo.accessToken = newAccessToken;
          localStorage.setItem("loginInfo", JSON.stringify(loginInfo));

          // 새로운 CSRF 헤더가 있다면 저장
          const newCsrf = refreshResponse.headers["x-xsrf-token"];
          if (newCsrf) {
            localStorage.setItem("XSRF-TOKEN", newCsrf);
          }

          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          return api(originalRequest);

        } catch (err) {
          console.error("❌ Refresh 실패", err);

          // 로그인 정보 제거
          localStorage.removeItem("loginInfo");
          localStorage.removeItem("XSRF-TOKEN");

          window.location.href = "/login";
          return Promise.reject(err);
        }
      }

      return Promise.reject(error);
    }
  );
}
