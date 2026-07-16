// PM2 process definitions for both Cyprus VIP Estates environments on the VPS.
// Ported from production's standalone (uncommitted) ecosystem.config.js during
// the staging->production merge (see MERGE_AUDIT.md) and extended with the
// cve-staging entry, matching each app's actual running config at merge time
// (confirmed via `pm2 describe` against both processes).
module.exports = {
  apps: [
    {
      name: "cyprusvipestates",
      script: "node_modules/.bin/next",
      args: "start",
      cwd: "/var/www/cyprusvipestates",
      instances: 2,
      exec_mode: "cluster",
      env: { NODE_ENV: "production", PORT: 3000 },
      max_restarts: 10,
      restart_delay: 4000,
      out_file: "/var/log/pm2/cvp-out.log",
      error_file: "/var/log/pm2/cvp-err.log",
      time: true,
    },
    {
      name: "cve-staging",
      script: "npm",
      args: "start -- -p 3200",
      cwd: "/var/www/cve-staging",
      instances: 1,
      exec_mode: "fork",
      max_restarts: 10,
      restart_delay: 4000,
      time: true,
    },
  ],
};
