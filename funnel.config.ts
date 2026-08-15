import { defineFunnelConfig } from "./src/lib/config-schema";
import { buildFunnelInput } from "./src/lib/funnelDefaults";

export default defineFunnelConfig(buildFunnelInput("A"));
