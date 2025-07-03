const sharp = require("sharp");
const { PutObjectCommand } = require("@aws-sdk/client-s3");
const { s3Client } = require("./s3-credentials");

exports.putObject = async (file, fileName) => {
  try {
    const image = sharp(file);
    const metadata = await image.metadata();

    let optimizedBuffer;
    let contentType;

    if (metadata.format === "jpeg" || metadata.format === "jpg") {
      optimizedBuffer = await image
        .resize({ width: 1200, withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toBuffer();
      contentType = "image/jpeg";
    } else if (metadata.format === "png") {
      optimizedBuffer = await image
        .resize({ width: 1200, withoutEnlargement: true })
        .png({ compressionLevel: 9 })
        .toBuffer();
      contentType = "image/png";
    } else if (metadata.format === "webp") {
      optimizedBuffer = await image
        .resize({ width: 1200, withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();
      contentType = "image/webp";
    } else {
      throw new Error("Unsupported image format: " + metadata.format);
    }

    const params = {
      Bucket: process.env.AWS_BUCKET,
      Key: `${fileName}`,
      Body: optimizedBuffer,
      ContentType: contentType,
    };

    const command = new PutObjectCommand(params);
    const data = await s3Client.send(command);

    if (data.$metadata.httpStatusCode !== 200) return;

    const url = `https://${process.env.AWS_BUCKET}.s3.${process.env.AWS_DEFAULT_REGION}.amazonaws.com/${params.Key}`;

    console.log(url);

    return { url, key: params.Key };
  } catch (err) {
    console.error("S3 Upload Error:", err.message);
  }
};
