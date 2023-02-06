require('dotenv').config()

const { spawn } = require('node:child_process');
const { createGzip } = require('node:zlib');
const { pipeline } = require('node:stream');
const { promisify } = require('node:util');

const s3Upload = require('s3-stream-upload');

const pipe = promisify(pipeline);

const env = require('env-var');
const config = {
  aws: {
    accessKey: env.get('AWS_ACCESS_KEY_ID').required().asString(),
    secretKey: env.get('AWS_SECRET_ACCESS_KEY').required().asString(),
    bucketName: env.get('AWS_BUCKET_NAME').required().asString(),
    bucketRegion: env.get('AWS_BUCKET_REGION').required().asString()
  },
  db: {
    user: env.get('DB_USER').required().asString(),
    password: env.get('DB_PASSWORD').required().asString(),
    database: env.get('DB_DATABASE').required().asString()
  }
};

async function mysqlBackup() {
  var upload = s3Upload({
    accessKeyId: config.aws.accessKey,
    secretAccessKey: config.aws.secretKey,
    Bucket: config.aws.bucketName,
    region: config.aws.bucketRegion
  });

  const s3 = upload({ Key: 'mysql-backup-' + new Date().toISOString() + '.sql' });

  const mysqldump = spawn('mysqldump', [
    '-u', config.db.user,
    '-p' + config.db.password,
    config.db.database
  ]);

  const gzip = createGzip();
  return pipe(mysqldump, gzip, s3);
};

mysqlBackup()
  .then(function () {
    console.log('Backup complete');
  })
  .catch(function (err) {
    console.error('Backup failed', err);
    process.exit(1);
  });