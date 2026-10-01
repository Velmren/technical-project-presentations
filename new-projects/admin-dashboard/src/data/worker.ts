import { generateWorkspace } from "./generate";

// Generating eighteen months of orders takes a few hundred milliseconds,
// so it runs off the main thread while the interface keeps animating.
self.postMessage(generateWorkspace());
