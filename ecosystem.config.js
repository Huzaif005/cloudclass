/**
 * ============================================================================
 * CLOUDCLASS - PM2 PROCESS MANAGER CONFIGURATION (AWS EC2)
 * ============================================================================
 * Enables cluster mode, zero-downtime reloads, and automatic crash recovery.
 * Usage:
 *   pm2 start ecosystem.config.js
 * ============================================================================
 */

module.exports = {
  apps: [
    {
      name: 'cloudclass-service',
      script: './server.js',
      instances: 'max',       // Utilize all available CPU cores
      exec_mode: 'cluster',   // High-availability cluster mode
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env_production: {
        NODE_ENV: 'production',
        PORT: 8000
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 8000
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      merge_logs: true
    }
  ]
};
