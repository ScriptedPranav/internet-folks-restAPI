import express from "express";
import cors from "cors";
import * as dotenv from "dotenv";

import roleRoute from "./routes/Role";
import userRoute from './routes/User';
import communityRoute from './routes/Community';

dotenv.config();

if (!process.env.PORT) {
  process.exit(1);
}

const PORT: number = parseInt(process.env.PORT as string, 10);

const app = express();

app.use(cors());
app.use(express.json())

app.use("/v1", roleRoute);
app.use("/v1/auth",userRoute)
app.use("/v1/community",communityRoute)


app.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`);
});
