const { spawn } = require("node:child_process")
const { createGzip } = require("node:zlib")
const { pipeline } = require("node:stream")
const { promisify } = require("node:util")
const schedule = require("node-schedule")

const s3Upload = require("s3-stream-upload")
const S3 = require("aws-sdk").S3

const pipe = promisify(pipeline)

const env = require("env-var")
const config = {
  aws: {
    accessKey: env.get("AWS_ACCESS_KEY_ID").required().asString(),
    secretKey: env.get("AWS_SECRET_ACCESS_KEY").required().asString(),
    bucketName: env.get("AWS_BUCKET_NAME").required().asString(),
    bucketRegion: env.get("AWS_BUCKET_REGION").required().asString(),
  },
  db: {
    user: env.get("MYSQL_USER").required().asString(),
    password: env.get("MYSQL_PASSWORD").required().asString(),
    database: env.get("MYSQL_DATABASE").required().asString(),
  },
  node: {
    environment: env.get("NODE_ENV").asString(),
  },
}

const s3Config = new S3({
  region: config.aws.bucketRegion,
  credentials: {
    accessKeyId: config.aws.accessKey,
    secretAccessKey: config.aws.secretKey,
  },
})

async function mysqlBackup() {
  const mysqldump = spawn("mysqldump", [
    `-u`,
    config.db.user,
    `--password=${config.db.password}`,
    config.db.database,
  ])
  mysqldump.on("error", function (error) {
    throw new Error(error)
  })
  const gzip = createGzip()
  const dumpFileName = "mysql-backup-" + new Date().toISOString() + ".sql.gz"
  const upload = s3Upload(s3Config, {
    Bucket: config.aws.bucketName,
    Key: dumpFileName,
  })

  return pipe(mysqldump.stdout, gzip, upload)
}

schedule.scheduleJob("0 * * * *", async function () {
  if (config.node.environment === "production") {
    mysqlBackup()
      .then(function () {
        console.log("Backup complete")
        process.exit(0)
      })
      .catch(function (err) {
        console.error("Backup failed", err)
        process.exit(1)
      })
  } else {
    console.log("Backup is only enabled in production")
    process.exit(0)
  }
})
