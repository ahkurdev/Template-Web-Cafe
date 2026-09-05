// PM2 — hanya backend yang butuh proses. Frontend statis di-serve Caddy.
module.exports = {
  apps: [
    {
      name: 'cafe-api',
      script: 'apps/api/dist/index.js',
      cwd: __dirname,
      // instances: 1 wajib. Socket.io multi-instance butuh adapter Redis untuk
      // broadcast lintas proses; tanpa itu order baru hanya sampai ke klien
      // yang kebetulan terhubung ke proses yang sama.
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '400M',
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      error_file: 'logs/api-err.log',
      out_file: 'logs/api-out.log',
      time: true,
    },
  ],
};
