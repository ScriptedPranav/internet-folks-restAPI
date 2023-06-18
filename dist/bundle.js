'use strict';

Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const express_1 = tslib_1.__importDefault(require("express"));
const cors_1 = tslib_1.__importDefault(require("cors"));
const dotenv = tslib_1.__importStar(require("dotenv"));
const Role_1 = tslib_1.__importDefault(require("./routes/Role"));
const User_1 = tslib_1.__importDefault(require("./routes/User"));
const Community_1 = tslib_1.__importDefault(require("./routes/Community"));
const Member_1 = tslib_1.__importDefault(require("./routes/Member"));
dotenv.config();
if (!process.env.PORT) {
    process.exit(1);
}
const PORT = parseInt(process.env.PORT, 10);
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use("/v1", Role_1.default);
app.use("/v1/auth", User_1.default);
app.use("/v1/community", Community_1.default);
app.use("/v1/member", Member_1.default);
app.listen(PORT, () => {
    console.log(`Listening on port ${PORT}`);
});
//# sourceMappingURL=bundle.js.map
