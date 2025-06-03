const { DeleteObjectCommand } = require("@aws-sdk/client-s3");
const { s3Client } = require("./s3-credentials");

exports.deletObject = async (key) => {
  try {
    const params = {
      Bucket: process.env.AWS_BUCKET,
      Key: `${key}`,
    };

    console.log(key);

    const command = new DeleteObjectCommand(params);

    const data = await s3Client.send(command);

    if (data.$metadata.httpStatusCode !== 204) {
      return { status: 400, data };
    }

    console.log(data.$metadata.httpStatusCode);

    return { status: 204 };
  } catch (error) {
    console.error(error);
  }
};
