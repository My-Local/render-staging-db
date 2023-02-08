module.exports = {
    apps: [
      {
        name: 'backup cron',
        script: "/backup/backup.js",
        watch: false,
        autorestart: true
      }
    ]
  };