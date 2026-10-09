import "./env";
import OpenAI from "openai";

// One client for the whole process. It reads OPENAI_API_KEY from process.env.
export const openai = new OpenAI();
