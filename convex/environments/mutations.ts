import { v } from "convex/values"
import { mutation } from "../_generated/server"

export const createProjectEnvironment = mutation({
	args: {
		id: v.id("projects"),
	},
	handler: async (ctx, args) => {
		const envId = await ctx.db.insert("environments", {
			projectId: args.id
		});

		return envId;
	}
})
