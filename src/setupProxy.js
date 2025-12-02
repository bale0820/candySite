const { createProxyMiddleware } = require("http-proxy-middleware");

module.exports = function (app) {
  app.use(
    "/api",
    createProxyMiddleware({
      target: "https://candybackend-5zz3.onrender.com",
      changeOrigin: true,
    })
  );
};
