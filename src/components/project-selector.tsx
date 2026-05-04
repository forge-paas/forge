import React from "react";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select"
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

export const ProjectSelector: React.FC<{
	value: Id<"projects"> | undefined;
	onChange: (value: Id<"projects">) => void;
}> = ({ value, onChange }) => {
	const user = useQuery(api.users.queries.current);
	const projects = useQuery(api.projects.queries.getAllProjectsForUser, user ? {
		userId: user._id
	} : "skip");
	if (!projects) return <div />;

	const selectedProject = projects.find(p => p._id === value);

	return (
		<Select value={value ?? ""} onValueChange={(v) => {
			if (!v) return;
			onChange(v as Id<"projects">);
		}}>
			<SelectTrigger className="w-[180px]">
				<SelectValue placeholder="Select a Project to Deploy" >
					{selectedProject ? selectedProject.name : "Select a Project to Deploy"}
				</SelectValue>
			</SelectTrigger>
			<SelectContent>
				<SelectGroup>
					{
						projects.map((p) => {
							return <SelectItem key={p._id} value={p._id}>{p.name}</SelectItem>
						})
					}
				</SelectGroup>
			</SelectContent>
		</Select>
	);
}
