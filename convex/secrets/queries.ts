import { v } from "convex/values";
import { internalQuery } from "../_generated/server";

export const getEnvSecrets = internalQuery({
	args: {
		envId: v.id("environments")
	},
	handler: async (ctx, args) => {
		return await ctx.db.query("secrets")
			.withIndex("by_envId", q => q.eq("environmentId", args.envId))
			.collect();
	}
});
