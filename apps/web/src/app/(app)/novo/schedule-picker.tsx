"use client";

import { Button } from "@autopost/ui/components/button";
import { Calendar } from "@autopost/ui/components/calendar";
import { Input } from "@autopost/ui/components/input";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@autopost/ui/components/popover";
import { Tabs, TabsList, TabsTrigger } from "@autopost/ui/components/tabs";
import { cn } from "@autopost/ui/lib/utils";
import { addDays, format, nextSaturday, set, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Clock, Zap } from "lucide-react";

export type Schedule = { mode: "now" | "later"; date: Date; time: string };

export function scheduleToDate(s: Schedule): Date | null {
	if (s.mode === "now") return null;
	const [h, m] = s.time.split(":").map(Number);
	return set(s.date, {
		hours: h ?? 9,
		minutes: m ?? 0,
		seconds: 0,
		milliseconds: 0,
	});
}

export function defaultSchedule(): Schedule {
	const now = new Date();
	return {
		mode: "now",
		date: now.getHours() >= 18 ? addDays(now, 1) : now,
		time: now.getHours() >= 18 ? "09:00" : "18:00",
	};
}

export function SchedulePicker({
	value,
	onChange,
}: {
	value: Schedule;
	onChange: (s: Schedule) => void;
}) {
	const today = startOfDay(new Date());
	const quick = [
		{ label: "Hoje 18h", date: today, time: "18:00" },
		{ label: "Amanhã 9h", date: addDays(today, 1), time: "09:00" },
		{ label: "Amanhã 12h", date: addDays(today, 1), time: "12:00" },
		{
			label: `${format(nextSaturday(today), "EEE d/M", { locale: ptBR })} 10h`,
			date: nextSaturday(today),
			time: "10:00",
		},
	].filter(
		(q) =>
			(scheduleToDate({ mode: "later", ...q })?.getTime() ?? 0) > Date.now(),
	);
	const when = scheduleToDate(value);
	const inPast = when ? when.getTime() < Date.now() : false;

	return (
		<div className="space-y-4">
			<Tabs
				value={value.mode}
				onValueChange={(mode) =>
					onChange({ ...value, mode: mode as Schedule["mode"] })
				}
			>
				<TabsList className="grid h-11 w-full grid-cols-2 sm:inline-flex sm:w-auto">
					<TabsTrigger
						value="now"
						className="min-w-0 px-2 sm:px-5"
						data-testid="when-now"
					>
						<Zap /> Publicar agora
					</TabsTrigger>
					<TabsTrigger
						value="later"
						className="min-w-0 px-2 sm:px-5"
						data-testid="when-later"
					>
						<Clock /> Agendar
					</TabsTrigger>
				</TabsList>
			</Tabs>

			{value.mode === "later" && (
				<div className="space-y-3">
					<div className="flex flex-wrap gap-2">
						<Popover>
							<PopoverTrigger
								render={
									<Button
										variant="outline"
										className="h-10 min-w-48 justify-start"
									/>
								}
							>
								<CalendarIcon className="text-gold-ink" />
								{format(value.date, "EEEE, dd 'de' MMMM", { locale: ptBR })}
							</PopoverTrigger>
							<PopoverContent className="w-auto p-0" align="start">
								<Calendar
									mode="single"
									locale={ptBR}
									selected={value.date}
									onSelect={(d) => d && onChange({ ...value, date: d })}
									disabled={{ before: today }}
								/>
							</PopoverContent>
						</Popover>
						<Input
							type="time"
							value={value.time}
							onChange={(e) => onChange({ ...value, time: e.target.value })}
							className="h-10 w-32"
							aria-label="Horário"
							data-testid="schedule-time"
						/>
					</div>
					<div className="flex flex-wrap gap-2">
						{quick.map((q) => {
							const active =
								value.time === q.time &&
								startOfDay(value.date).getTime() === q.date.getTime();
							return (
								<button
									key={q.label}
									type="button"
									onClick={() =>
										onChange({ mode: "later", date: q.date, time: q.time })
									}
									className={cn(
										"text-muted-foreground hover:border-gold/60 hover:text-foreground min-h-10 rounded-full border px-4 py-2 text-sm transition-colors",
										active && "border-gold bg-accent text-accent-foreground",
									)}
								>
									{q.label}
								</button>
							);
						})}
					</div>
					{inPast && (
						<p className="text-destructive text-sm">
							Esse horário já passou — escolha um horário futuro.
						</p>
					)}
				</div>
			)}
		</div>
	);
}
