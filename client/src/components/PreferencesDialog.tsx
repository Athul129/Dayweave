import { useEffect, useState } from "react";

import { getDefaultTaskMinutes, setDefaultTaskMinutes } from "@/lib/preferences";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface PreferencesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const durationOptions = [15, 30, 45, 60] as const;

export function PreferencesDialog({ open, onOpenChange }: PreferencesDialogProps) {
  const [defaultTaskMinutes, setSelectedDuration] = useState(getDefaultTaskMinutes);

  useEffect(() => {
    if (open) {
      setSelectedDuration(getDefaultTaskMinutes());
    }
  }, [open]);

  const handleDurationChange = (value: string) => {
    const minutes = Number(value);
    if (!durationOptions.includes(minutes as (typeof durationOptions)[number])) return;

    setSelectedDuration(minutes);
    setDefaultTaskMinutes(minutes);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-[20px] border-[#e8e4da] bg-[#fbfaf6] p-5 text-[#292d3b] shadow-[0_18px_60px_rgba(30,35,48,0.16)] sm:p-7">
        <DialogHeader className="gap-2 pr-7 text-left">
          <DialogTitle className="text-xl font-semibold tracking-[-0.03em] sm:text-2xl">
            Preferences
          </DialogTitle>
          <DialogDescription className="text-sm leading-6 text-[#77776f]">
            Choose the starting length for new tasks.
          </DialogDescription>
        </DialogHeader>

        <section className="mt-2 min-w-0 rounded-2xl border border-[#e9e5dc] bg-white/70 p-4 sm:p-5">
          <h2 className="mb-3 text-sm font-semibold text-[#343632]">
            Default task duration
          </h2>
          <RadioGroup
            aria-label="Default task duration"
            value={String(defaultTaskMinutes)}
            onValueChange={handleDurationChange}
            className="grid grid-cols-2 gap-2 sm:grid-cols-4"
          >
            {durationOptions.map((minutes) => {
              const id = `default-task-duration-${minutes}`;
              const selected = defaultTaskMinutes === minutes;

              return (
                <label
                  key={minutes}
                  htmlFor={id}
                  className={`flex min-w-0 cursor-pointer items-center justify-center gap-1 rounded-xl border px-3 py-3 text-sm transition-colors focus-within:ring-2 focus-within:ring-[#6f7f63]/40 ${
                    selected
                      ? "border-[#89967b] bg-[#f1f3ec] text-[#303b2d]"
                      : "border-[#e8e5dd] bg-[#fffefa] text-[#55564f] hover:border-[#c9cdbf]"
                  }`}
                >
                  <RadioGroupItem
                    id={id}
                    value={String(minutes)}
                    className="border-[#9a9b91] text-[#657458] shadow-none [&_[data-slot=radio-group-indicator]>svg]:fill-[#657458] [&_[data-slot=radio-group-indicator]>svg]:stroke-[#657458]"
                  />
                  <span className="whitespace-nowrap">{minutes} minutes</span>
                </label>
              );
            })}
          </RadioGroup>
        </section>
      </DialogContent>
    </Dialog>
  );
}
