"use client";

import { Button } from "@autopost/ui/components/button";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyTitle,
} from "@autopost/ui/components/empty";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@autopost/ui/components/sheet";
import { Skeleton } from "@autopost/ui/components/skeleton";
import { cn } from "@autopost/ui/lib/utils";
import {
	DndContext,
	type DragEndEvent,
	DragOverlay,
	PointerSensor,
	TouchSensor,
	useDraggable,
	useDroppable,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import { useQuery } from "@tanstack/react-query";
import {
	addMonths,
	eachDayOfInterval,
	endOfMonth,
	endOfWeek,
	format,
	isSameDay,
	isSameMonth,
	isToday,
	set,
	startOfDay,
	startOfMonth,
	startOfWeek,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useState } from "react";

import { QueryError, StatusIcon } from "@/components/page";
import { PlatformIcon } from "@/components/platform-icon";
import { PostCard, usePostActions } from "@/components/post-card";
import type { PostItem } from "@/lib/types";
import { orpc } from "@/utils/orpc";

const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

export function AgendaView() {
	const [month, setMonth] = useState(() => startOfMonth(new Date()));
	const [openDay, setOpenDay] = useState<Date | null>(null);
	const [dragging, setDragging] = useState<PostItem | null>(null);
	const { reschedule } = usePostActions();

	const gridStart = startOfWeek(startOfMonth(month));
	const gridEnd = endOfWeek(endOfMonth(month));
	const days = eachDayOfInterval({ start: gridStart, end: gridEnd });
	const posts = useQuery({
		...orpc.posts.list.queryOptions({
			input: { from: gridStart, to: gridEnd, limit: 500 },
		}),
		refetchInterval: 15_000,
	});
	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
		useSensor(TouchSensor, {
			activationConstraint: { delay: 200, tolerance: 8 },
		}),
	);

	const postsOn = (day: Date) =>
		(posts.data ?? [])
			.filter((p) => isSameDay(new Date(p.scheduledAt), day))
			.sort(
				(a, b) =>
					new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
			);

	const onDragEnd = (e: DragEndEvent) => {
		setDragging(null);
		const post = posts.data?.find((p) => p.id === e.active.id);
		if (!post || !e.over) return;
		const day = new Date(String(e.over.id));
		const old = new Date(post.scheduledAt);
		if (isSameDay(day, old)) return;
		const next = set(day, {
			hours: old.getHours(),
			minutes: old.getMinutes(),
			seconds: 0,
			milliseconds: 0,
		});
		reschedule.mutate({ id: post.id, scheduledAt: next });
	};

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between gap-2">
				<h2 className="font-display text-2xl first-letter:uppercase">
					{format(month, "MMMM 'de' yyyy", { locale: ptBR })}
				</h2>
				<div className="flex gap-1">
					<Button
						variant="outline"
						size="icon"
						aria-label="Mês anterior"
						onClick={() => setMonth((m) => addMonths(m, -1))}
					>
						<ChevronLeft />
					</Button>
					<Button
						variant="outline"
						onClick={() => setMonth(startOfMonth(new Date()))}
					>
						Hoje
					</Button>
					<Button
						variant="outline"
						size="icon"
						aria-label="Próximo mês"
						onClick={() => setMonth((m) => addMonths(m, 1))}
					>
						<ChevronRight />
					</Button>
				</div>
			</div>

			{posts.isError && (
				<QueryError error={posts.error} onRetry={() => posts.refetch()} />
			)}

			{/* Celular: lista por dia (o calendário de 7 colunas fica apertado demais) */}
			<MobileAgenda
				days={days.filter((d) => isSameMonth(d, month))}
				postsOn={postsOn}
				loading={posts.isPending}
			/>

			<div className="hidden md:block">
				<DndContext
					sensors={sensors}
					onDragStart={(e) =>
						setDragging(posts.data?.find((p) => p.id === e.active.id) ?? null)
					}
					onDragEnd={onDragEnd}
					onDragCancel={() => setDragging(null)}
				>
					<div className="bg-card overflow-hidden rounded-2xl border">
						<div className="bg-muted/40 grid grid-cols-7 border-b">
							{WEEKDAYS.map((d) => (
								<div
									key={d}
									className="text-muted-foreground px-2 py-2 text-center text-xs font-semibold tracking-wider uppercase"
								>
									{d}
								</div>
							))}
						</div>
						<div className="grid grid-cols-7">
							{days.map((day) =>
								posts.isPending ? (
									<div
										key={day.toISOString()}
										className="min-h-24 border-r border-b p-2 md:min-h-32"
									>
										<Skeleton className="h-4 w-6" />
									</div>
								) : (
									<DayCell
										key={day.toISOString()}
										day={day}
										inMonth={isSameMonth(day, month)}
										posts={postsOn(day)}
										onOpen={() => setOpenDay(day)}
									/>
								),
							)}
						</div>
					</div>
					<DragOverlay dropAnimation={null}>
						{dragging ? <PostChip post={dragging} overlay /> : null}
					</DragOverlay>
				</DndContext>
			</div>

			<Sheet
				open={Boolean(openDay)}
				onOpenChange={(o) => !o && setOpenDay(null)}
			>
				<SheetContent className="w-full overflow-y-auto sm:max-w-xl">
					{openDay && (
						<>
							<SheetHeader>
								<SheetTitle className="font-display text-2xl font-normal capitalize">
									{format(openDay, "EEEE, dd 'de' MMMM", { locale: ptBR })}
								</SheetTitle>
								<SheetDescription>
									{postsOn(openDay).length} post(s) neste dia
								</SheetDescription>
							</SheetHeader>
							<div className="space-y-3 px-4 pb-6">
								{postsOn(openDay).map((p) => (
									<PostCard key={p.id} post={p} />
								))}
								{startOfDay(openDay) >= startOfDay(new Date()) && (
									<Button
										render={<Link href="/novo" />}
										nativeButton={false}
										variant="outline"
										className="w-full"
									>
										<Plus /> Novo post
									</Button>
								)}
							</div>
						</>
					)}
				</SheetContent>
			</Sheet>
		</div>
	);
}

function MobileAgenda({
	days,
	postsOn,
	loading,
}: {
	days: Date[];
	postsOn: (d: Date) => PostItem[];
	loading: boolean;
}) {
	if (loading)
		return (
			<div className="space-y-3 md:hidden">
				<Skeleton className="h-28 rounded-2xl" />
				<Skeleton className="h-28 rounded-2xl" />
			</div>
		);
	const withPosts = days.filter((d) => postsOn(d).length > 0);
	return (
		<div className="space-y-6 md:hidden" data-testid="agenda-mobile">
			{withPosts.length === 0 && (
				<Empty className="border">
					<EmptyHeader>
						<EmptyTitle>Nada neste mês</EmptyTitle>
						<EmptyDescription>
							Os posts agendados aparecem aqui, organizados por dia.
						</EmptyDescription>
					</EmptyHeader>
					<EmptyContent>
						<Button render={<Link href="/novo" />} nativeButton={false}>
							<Plus /> Novo post
						</Button>
					</EmptyContent>
				</Empty>
			)}
			{withPosts.map((d) => (
				<section key={d.toISOString()} className="space-y-2">
					<h3
						className={cn(
							"text-sm font-semibold first-letter:uppercase",
							isToday(d) && "text-gold-ink",
						)}
					>
						{isToday(d) ? "Hoje · " : ""}
						{format(d, "EEEE, dd 'de' MMMM", { locale: ptBR })}
					</h3>
					{postsOn(d).map((p) => (
						<PostCard key={p.id} post={p} />
					))}
				</section>
			))}
		</div>
	);
}

function DayCell({
	day,
	inMonth,
	posts,
	onOpen,
}: {
	day: Date;
	inMonth: boolean;
	posts: PostItem[];
	onOpen: () => void;
}) {
	const past = startOfDay(day) < startOfDay(new Date());
	const { isOver, setNodeRef } = useDroppable({
		id: day.toISOString(),
		disabled: past,
	});
	return (
		<div
			ref={setNodeRef}
			data-testid={`day-${format(day, "yyyy-MM-dd")}`}
			className={cn(
				"group relative min-h-24 border-r border-b p-1.5 transition-colors md:min-h-32 md:p-2 [&:nth-child(7n)]:border-r-0",
				!inMonth && "bg-muted/30 text-muted-foreground",
				isOver && "bg-accent/60",
			)}
		>
			<button
				type="button"
				onClick={onOpen}
				className={cn(
					"hover:bg-accent mb-1 flex size-6 items-center justify-center rounded-full text-xs",
					isToday(day) && "bg-primary text-primary-foreground font-bold",
				)}
			>
				{format(day, "d")}
			</button>
			{!past && (
				<Link
					href={`/novo?data=${format(day, "yyyy-MM-dd")}` as Route}
					aria-label={`Novo post em ${format(day, "dd/MM")}`}
					className="text-muted-foreground hover:bg-accent hover:text-foreground absolute top-1.5 right-1.5 flex size-7 items-center justify-center rounded-full opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
				>
					<Plus className="size-4" />
				</Link>
			)}
			<div className="space-y-1">
				{posts.slice(0, 3).map((p) => (
					<PostChip key={p.id} post={p} onClick={onOpen} />
				))}
				{posts.length > 3 && (
					<button
						type="button"
						onClick={onOpen}
						className="text-muted-foreground hover:text-foreground px-1 text-xs"
					>
						+{posts.length - 3} mais
					</button>
				)}
			</div>
		</div>
	);
}

function PostChip({
	post,
	overlay,
	onClick,
}: {
	post: PostItem;
	overlay?: boolean;
	onClick?: () => void;
}) {
	const canDrag = post.status === "scheduled";
	const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
		id: post.id,
		disabled: !canDrag || overlay,
	});
	const platforms = [...new Set(post.targets.map((t) => t.platform))];
	return (
		<button
			type="button"
			ref={overlay ? undefined : setNodeRef}
			onClick={onClick}
			data-testid={`agenda-post-${post.id}`}
			className={cn(
				"bg-background flex w-full touch-none items-center gap-1 overflow-hidden rounded-md border px-1.5 py-1 text-left text-[0.7rem] leading-tight",
				canDrag && "border-gold/40 cursor-grab",
				isDragging && "opacity-30",
				overlay && "glow-gold border-gold w-40 rotate-2 cursor-grabbing",
			)}
			{...(overlay ? {} : attributes)}
			{...(overlay ? {} : listeners)}
		>
			<StatusIcon status={post.status} className="size-3 shrink-0" />
			<span className="shrink-0 font-semibold tabular-nums">
				{format(new Date(post.scheduledAt), "HH:mm")}
			</span>
			<span className="text-muted-foreground hidden min-w-0 flex-1 truncate md:inline">
				{post.caption || "Sem legenda"}
			</span>
			<span className="ml-auto hidden shrink-0 gap-0.5 lg:flex">
				{platforms.slice(0, 3).map((p) => (
					<PlatformIcon key={p} platform={p} className="size-2.5 opacity-70" />
				))}
			</span>
		</button>
	);
}
