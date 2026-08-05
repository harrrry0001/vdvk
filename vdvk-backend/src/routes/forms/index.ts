import type { HonoEnv } from "../../middleware/auth.js";
import { Hono } from "hono";
import { form1Routes } from "./form1-collection.js";
import { form2Routes } from "./form2-stock-transfer.js";
import { form3Routes } from "./form3-processing.js";
import { form4Routes } from "./form4-sales.js";
import { form5Routes, form6Routes } from "./form5-6.js";
import { form7Routes } from "./form7-machinery.js";
import { form8Routes } from "./form8-utilisation.js";
import { form9Routes, form10Routes, form11Routes, form12Routes } from "./form9-10-12.js";

export const formRoutes = new Hono<HonoEnv>();

formRoutes.route("/form1", form1Routes);
formRoutes.route("/form2", form2Routes);
formRoutes.route("/form3", form3Routes);
formRoutes.route("/form4", form4Routes);
formRoutes.route("/form5", form5Routes);
formRoutes.route("/form6", form6Routes);
formRoutes.route("/form7", form7Routes);
formRoutes.route("/form8", form8Routes);
formRoutes.route("/form9", form9Routes);
formRoutes.route("/form10", form10Routes);
formRoutes.route("/form11", form11Routes);
formRoutes.route("/form12", form12Routes);
