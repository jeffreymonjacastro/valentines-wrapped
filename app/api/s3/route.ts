import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  // Ensure these env vars are set before using the endpoint:
  // AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, AWS_S3_BUCKET_NAME
  // Also enable CORS on the bucket for PUT requests from your domain.
});

export async function POST(request: Request) {
  const body = (await request.json()) as {
    filename?: string;
    contentType?: string;
    folder?: string;
  };

  const bucket = process.env.AWS_S3_BUCKET_NAME;
  if (!bucket || !process.env.AWS_REGION) {
    return NextResponse.json(
      { error: "Missing S3 configuration." },
      { status: 500 }
    );
  }

  if (!body.filename || !body.contentType) {
    return NextResponse.json(
      { error: "filename and contentType are required." },
      { status: 400 }
    );
  }

  const safeFolder = body.folder?.replace(/[^a-z0-9-_/]/gi, "") || "uploads";
  const key = `${safeFolder}/${randomUUID()}-${body.filename}`;

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: body.contentType,
  });

  const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

  return NextResponse.json({ uploadUrl, key, bucket });
}
