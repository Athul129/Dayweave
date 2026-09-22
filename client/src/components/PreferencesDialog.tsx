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
const isPresetDuration = (minutes: number): minutes is (typeof durationOptions)[number] => durationOptions.includes(minutes as (typeof durationOptions)[number]);
const isValidCustomDuration = (value: string) => {
  const minutes = Number(value.trim());
  return Number.isInteger(minutes) && minutes >= 1 && minutes <= 1440 && minutes % 5 === 0;
};

export function PreferencesDialog({ open, onOpenChange }: PreferencesDialogProps) {
  const [defaultTaskMinutes, setSelectedDuration] = useState(getDefaultTaskMinutes);
  const [customMinutes, setCustomMinutes] = useState("");
  const [customError, setCustomError] = useState("");

  useEffect(() => {
    if (open) {
      const minutes = getDefaultTaskMinutes();
      setSelectedDuration(minutes);
      setCustomMinutes(String(minutes));
      setCustomError("");
    }
  }, [open]);

  const handleDurationChange = (value: string) => {
    const minutes = Number(value);
    if (value === "custom") {
      setSelectedDuration(isPresetDuration(defaultTaskMinutes) ? 0 : defaultTaskMinutes);
      if (isPresetDuration(defaultTaskMinutes)) setCustomMinutes("");
      setCustomError("");
      return;
    }
    if (!isPresetDuration(minutes)) return;

    setSelectedDuration(minutes);
    setDefaultTaskMinutes(minutes);
    setCustomError("");
  };

  const handleCustomMinutesChange = (value: string) => {
    setCustomMinutes(value);
    const trimmed = value.trim();
    if (!trimmed) {
      setCustomError("Enter a duration from 1 to 1,440 minutes.");
      return;
    }
    const minutes = Number(trimmed);
    if (Number.isInteger(minutes) && minutes >= 1 && minutes <= 1440 && minutes % 5 !== 0) {
      setCustomError("Choose a duration in 5-minute increments.");
      return;
    }
    if (!isValidCustomDuration(trimmed)) {
      setCustomError("Enter a whole number from 1 to 1,440 minutes.");
      return;
    }
    setCustomError("");
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
            value={isPresetDuration(defaultTaskMinutes) ? String(defaultTaskMinutes) : "custom"}
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
            <label
              htmlFor="default-task-duration-custom"
              className={`col-span-2 flex min-w-0 cursor-pointer items-center justify-center gap-1 rounded-xl border px-3 py-3 text-sm transition-colors focus-within:ring-2 focus-within:ring-[#6f7f63]/40 sm:col-span-1 ${
                !isPresetDuration(defaultTaskMinutes)
                  ? "border-[#89967b] bg-[#f1f3ec] text-[#303b2d]"
                  : "border-[#e8e5dd] bg-[#fffefa] text-[#55564f] hover:border-[#c9cdbf]"
              }`}
            >
              <RadioGroupItem
                id="default-task-duration-custom"
                value="custom"
                className="border-[#9a9b91] text-[#657458] shadow-none [&_[data-slot=radio-group-indicator]>svg]:fill-[#657458] [&_[data-slot=radio-group-indicator]>svg]:stroke-[#657458]"
              />
              <span className="whitespace-nowrap">Custom</span>
            </label>
          </RadioGroup>
          {!isPresetDuration(defaultTaskMinutes) && (
            <div className="mt-3 grid gap-2">
              <label htmlFor="custom-task-duration" className="text-sm font-medium text-[#343632]">Custom minutes</label>
              <input id="custom-task-duration" type="number" min="1" max="1440" step="5" inputMode="numeric" value={customMinutes} onChange={(event) => handleCustomMinutesChange(event.target.value)} className="min-h-11 rounded-lg border border-[#cfd8cf] bg-[#fffdf7] px-3 text-[#283b3e] outline-none focus:border-[#89967b] focus:ring-2 focus:ring-[#6f7f63]/30" aria-invalid={Boolean(customError)} aria-describedby={customError ? "custom-task-duration-error" : undefined} />
              {customError && <p id="custom-task-duration-error" className="m-0 text-sm text-[#b86648]" role="alert">{customError}</p>}
            </div>
          )}
        </section>
      </DialogContent>
    </Dialog>
  );
}
