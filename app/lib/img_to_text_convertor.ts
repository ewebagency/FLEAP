import { createWorker } from "tesseract.js";

const convertor = async (img: string) => {
  const worker = await createWorker("fra");
  const ret = await worker.recognize(img);
  const text = ret.data.text;
  await worker.terminate();
  return text;
};

export default convertor;