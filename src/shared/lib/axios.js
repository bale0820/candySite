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
  withCredentials: true
});

export function setupApiInterceptors() {

  api.interceptors.request.use((config) => {
    const loginInfo = JSON.parse(localStorage.getItem("loginInfo"));
    if (loginInfo?.accessToken) {
      config.headers.Authorization = `Bearer ${loginInfo.accessToken}`;
    }

    // 🔥 기존 쿠키 방식 제거
    // document.cookie XSRF 읽기 삭제

    // 🔥 localStorage에서 CSRF 토큰 꺼내어 헤더에 세팅
    const csrf = localStorage.getItem("XSRF-TOKEN");
    if (csrf) {
      config.headers["X-XSRF-TOKEN"] = csrf;
    }

    return config;
  });

  let isRefreshing = false;
  let refreshSubscribers = [];

  const onRefreshed = (token) => {
    refreshSubscribers.forEach((cb) => cb(token));
    refreshSubscribers = [];
  };

  const addSubscriber = (cb) => {
    refreshSubscribers.push(cb);
  };

  api.interceptors.response.use(
    (res) => {

      // 🔥 응답 헤더에 CSRF 있으면 저장
      const newCsrf = res.headers["x-xsrf-token"];
      if (newCsrf) {
        localStorage.setItem("XSRF-TOKEN", newCsrf);
      }

      return res;
    },
    async (error) => {
      const originalRequest = error.config;

      if ([401, 403].includes(error.response?.status) && !originalRequest._retry) {
        originalRequest._retry = true;

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
          const refreshResponse = await api.post("/auth/refresh");
          const newAccessToken = refreshResponse.data.accessToken;

          const loginInfo = JSON.parse(localStorage.getItem("loginInfo")) || {};
          loginInfo.accessToken = newAccessToken;
          localStorage.setItem("loginInfo", JSON.stringify(loginInfo));

          // 🔥 refresh 응답에서 새로운 CSRF 받아 저장
          const newCsrf = refreshResponse.headers["x-xsrf-token"];
          if (newCsrf) {
            localStorage.setItem("XSRF-TOKEN", newCsrf);
          }

          api.defaults.headers.common["Authorization"] = `Bearer ${newAccessToken}`;

          onRefreshed(newAccessToken);
          isRefreshing = false;

          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          return api(originalRequest);

        } catch (err) {
          console.error("❌ Refresh failed:", err);

          // 🔥 실패 시 localStorage CSRF 삭제
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
