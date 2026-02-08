module.exports = {
  apps: [
    {
      name: 'roomflow-api',
      script: 'api/server.js',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      watch: false,
      max_restarts: 10,
      restart_delay: 2000,
      env: {
        NODE_ENV: 'development'
      },
      env_production: {
        NODE_ENV: 'production'
      }
    }
  ]
};
