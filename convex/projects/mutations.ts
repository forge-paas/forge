import { v } from "convex/values";
import { internalMutation, mutation } from "../_generated/server";
import { getCurrentUser } from "../users/queries";

export const updateProjectPostInstall = mutation({
	args: {
		id: v.id("projects"),
		postInstall: v.array(v.object({
			name: v.string(),
			command: v.string(),
		})),
	},
	handler: async (ctx, args) => {
		const user = await getCurrentUser(ctx);
		if (!user) throw new Error("Unauthorized");

		const project = await ctx.db.get(args.id);
		if (!project) throw new Error("Project not found");
		if (project.ownerId !== user._id) throw new Error("Forbidden");

		const seen = new Set<string>();
		for (const c of args.postInstall) {
			const name = c.name.trim();
			if (!name) throw new Error("Command name is required");
			if (!c.command.trim()) throw new Error("Command is required");
			if (seen.has(name)) throw new Error(`Duplicate command name: ${name}`);
			seen.add(name);
		}

		const cleaned = args.postInstall.map(c => ({
			name: c.name.trim(),
			command: c.command.trim(),
		}));

		await ctx.db.patch(args.id, { postInstall: cleaned });
	},
});

export const createProject = mutation({
	args: {
		name: v.string(),
		ownerId: v.id("users"),
		defaultBranch: v.string(),
		repoUrl: v.string(),
		framework: v.string()
	},
	handler: async (ctx, args) => {
		const id = await ctx.db.insert("projects", {
			name: args.name,
			ownerId: args.ownerId,
			framework: args.framework,
			defaultBranch: "main",
			repoUrl: args.repoUrl,
			buildCommand: "",
			startCommand: ""
		});

		return id;
	}
});

export const updateProjectFramework = internalMutation({
	args: {
		id: v.id("projects"),
		framework: v.string(),
	},
	handler: async (ctx, args) => {
		return await ctx.db.patch("projects", args.id, { framework: args.framework })
	}
})

export const cascadeDeleteProject = internalMutation({
	args: { id: v.id("projects") },
	handler: async (ctx, args) => {
		const env = await ctx.db.query("environments")
			.withIndex("by_projectId", q => q.eq("projectId", args.id))
			.unique();
		if (env) {
			const secrets = await ctx.db.query("secrets")
				.withIndex("by_envId", q => q.eq("environmentId", env._id))
				.collect();
			for (const s of secrets) {
				await ctx.db.delete("secrets", s._id);
			}
			await ctx.db.delete("environments", env._id);
		}

		const deps = await ctx.db.query("deployments")
			.withIndex("by_projectId", q => q.eq("projectId", args.id))
			.collect();
		for (const d of deps) {
			await ctx.db.delete("deployments", d._id);
		}

		await ctx.db.delete("projects", args.id);
	}
})
