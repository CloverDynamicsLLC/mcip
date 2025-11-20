import { v5 as uuidv5 } from "uuid";

// Add this inside the class or as a utility
export const generateId = (shopId: string): string => {
	const NAMESPACE = "1b671a64-40d5-491e-99b0-da01ff1f3341"; // Random constant UUID
	return uuidv5(shopId, NAMESPACE);
};
