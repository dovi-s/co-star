import serverless from "serverless-http";
import { createApp } from "../server/app";

export const config = {
  api: {
    bodyParser: false,
  },
};

let cachedHandler: ReturnType<typeof serverless> | null = null;

async function getHandler() {
  if (!cachedHandler) {
    const { app } = await createApp({ enableMultiplayer: false });
    cachedHandler = serverless(app);
  }

  return cachedHandler;
}

export default async function handler(req: any, res: any) {
  const appHandler = await getHandler();
  return appHandler(req, res);
}
