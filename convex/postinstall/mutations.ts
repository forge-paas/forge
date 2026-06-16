import { v } from "convex/values";
import { internalMutation, mutation } from "../_generated/server";
import { internal } from "../_generated/api";
import { getCurrentUser } from "../users/queries";
import { Id } from "../_generated/dataModel";

const EXPIRY_MS = 10 * 60 * 1000;

export const runPostInstall = mutation({
	args: { deploymentId: v.id("deployments"), name: v.string() },
	handler: async (ctx, args): Promise<Id<"postInstallRuns">> => {
		const user = await getCurrentUser(ctx);
		if (!user) throw new Error("Unauthorized");

		const dep = await ctx.db.get(args.deploymentId);
		if (!dep) throw new Error("Deployment not found");

		if (dep.status !== "completed") {
			throw new Error("Deployment must be running before postinstall commands can run");
		}

		if (dep.type === "infra") {
			if (!dep.infraId) throw new Error("Infra container not found");
			const container = await ctx.db.get(dep.infraId);
			if (!container || container.ownerId !== user._id) throw new Error("Forbidden");

			const command = (container.postInstall ?? []).find(c => c.name === args.name);
			if (!command) throw new Error("Postinstall command not found");

			return await ctx.db.insert("postInstallRuns", {
				deploymentId: args.deploymentId,
				nodeId: dep.nodeId,
				name: command.name,
				service: command.service,
				command: command.command,
				status: "queued",
				output: "",
			});
		}

		if (!dep.projectId) throw new Error("Project not found");
		const project = await ctx.db.get(dep.projectId);
		if (!project || project.ownerId !== user._id) throw new Error("Forbidden");

		const command = (project.postInstall ?? []).find(c => c.name === args.name);
		if (!command) throw new Error("Postinstall command not found");

		return await ctx.db.insert("postInstallRuns", {
			deploymentId: args.deploymentId,
			nodeId: dep.nodeId,
			name: command.name,
			command: command.command,
			status: "queued",
			output: "",
		});
	}
});

export const clearPostInstallRun = mutation({
	args: { id: v.id("postInstallRuns") },
	handler: async (ctx, args) => {
		const user = await getCurrentUser(ctx);
		if (!user) throw new Error("Unauthorized");

		const run = await ctx.db.get(args.id);
		if (!run) return;

		const dep = await ctx.db.get(run.deploymentId);
		const ownerId = dep?.infraId
			? (await ctx.db.get(dep.infraId))?.ownerId
			: dep?.projectId
				? (await ctx.db.get(dep.projectId))?.ownerId
				: undefined;
		if (!ownerId || ownerId !== user._id) throw new Error("Forbidden");

		await ctx.db.delete(args.id);
	}
});

export const markRunRunning = internalMutation({
	args: { id: v.id("postInstallRuns") },
	handler: async (ctx, args) => {
		const run = await ctx.db.get(args.id);
		if (!run || run.status !== "queued") return;
		await ctx.db.patch(args.id, { status: "running" });
	}
});

export const completePostInstallRun = internalMutation({
	args: {
		id: v.id("postInstallRuns"),
		output: v.string(),
		exitCode: v.number(),
	},
	handler: async (ctx, args) => {
		const run = await ctx.db.get(args.id);
		if (!run) return;
		await ctx.db.patch(args.id, {
			status: args.exitCode === 0 ? "done" : "failed",
			output: args.output,
			exitCode: args.exitCode,
		});
		await ctx.scheduler.runAfter(EXPIRY_MS, internal.postinstall.mutations.expirePostInstallRun, { id: args.id });
	}
});

export const expirePostInstallRun = internalMutation({
	args: { id: v.id("postInstallRuns") },
	handler: async (ctx, args) => {
		const run = await ctx.db.get(args.id);
		if (!run) return;
		await ctx.db.delete(args.id);
	}
});
