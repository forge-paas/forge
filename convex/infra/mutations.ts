import { v } from "convex/values";
import { mutation } from "../_generated/server";

export const createInfraContainer = mutation({
	args: {
		ownerId: v.id("users"),
		nodeId: v.id("nodes"),
		templateId: v.id("infraTemplates"),
		containerName: v.string(),
		composeYaml: v.string(),
		postInstall: v.optional(v.array(v.object({
			name: v.string(),
			service: v.string(),
			command: v.string(),
		}))),
		healthCheck: v.optional(v.object({
			service: v.string(),
			command: v.string(),
		})),
	},
	handler: async (ctx, args) => {
		return await ctx.db.insert("infraContainers", {
			ownerId: args.ownerId,
			nodeId: args.nodeId,
			templateId: args.templateId,
			containerName: args.containerName,
			composeYaml: args.composeYaml,
			postInstall: args.postInstall,
			healthCheck: args.healthCheck,
		});
	}
});

export const createInfraEnvironment = mutation({
	args: { id: v.id("infraContainers") },
	handler: async (ctx, args) => {
		return await ctx.db.insert("infraEnvironments", {
			infraId: args.id,
		});
	}
});
