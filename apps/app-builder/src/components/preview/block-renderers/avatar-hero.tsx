import type { AvatarHeroProps } from '@lunara/blocks';

export function AvatarHeroPreview({ name, subtitle, editable }: AvatarHeroProps) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-[12px] font-bold text-white">
        {name.charAt(0)}
      </div>
      <p className="text-[9px] font-bold text-slate-900">{name}</p>
      {subtitle ? <p className="text-[7px] text-muted">{subtitle}</p> : null}
      {editable ? <p className="text-[7px] font-semibold text-primary">Edit profile</p> : null}
    </div>
  );
}
