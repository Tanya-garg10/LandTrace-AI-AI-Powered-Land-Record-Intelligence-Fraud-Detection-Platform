import { AlertTriangle, CheckCircle2, Clock, FileWarning, ShieldAlert, XCircle } from 'lucide-react';

export function VerificationStatusText({ status }: { status: string }) {
  switch (status) {
    case 'Verified':
    case 'Approved':
    case 'Matched':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#398568] whitespace-nowrap">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          <span>{status}</span>
        </span>
      );
    case 'Pending Review':
    case 'Submitted':
    case 'Under Review':
    case 'Documents Required':
    case 'Under Scrutiny':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#C5831B] whitespace-nowrap">
          <Clock className="w-3.5 h-3.5 shrink-0" />
          <span>{status}</span>
        </span>
      );
    case 'Flagged':
    case 'Under Investigation':
    case 'Flagged for Investigation':
    case 'Disputed':
    case 'Mismatched':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#D95B55] whitespace-nowrap">
          <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
          <span>{status}</span>
        </span>
      );
    case 'Rejected':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#6B7280] whitespace-nowrap">
          <XCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{status}</span>
        </span>
      );
    case 'Missing':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#C5831B] whitespace-nowrap">
          <FileWarning className="w-3.5 h-3.5 shrink-0" />
          <span>{status}</span>
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#616D66] whitespace-nowrap">
          <span>{status}</span>
        </span>
      );
  }
}

export function RiskScoreDisplay({ score, category }: { score: number; category: string }) {
  let color = 'text-[#398568]';
  let barColor = 'bg-[#398568]';
  if (category === 'Critical' || score >= 80) {
    color = 'text-[#D95B55]';
    barColor = 'bg-[#D95B55]';
  } else if (category === 'High' || score >= 60) {
    color = 'text-[#E67E45]';
    barColor = 'bg-[#E67E45]';
  } else if (category === 'Medium' || score >= 30) {
    color = 'text-[#C5831B]';
    barColor = 'bg-[#E5A13A]';
  }

  return (
    <div className="inline-flex items-center gap-2 whitespace-nowrap">
      <div className="w-14 h-1.5 bg-[#EAF0E9] rounded-full overflow-hidden">
        <div
          className={`h-full ${barColor} rounded-full transition-all duration-300`}
          style={{ width: `${Math.min(100, Math.max(6, score))}%` }}
        />
      </div>
      <span className={`font-display text-xs font-semibold tabular-nums ${color}`}>
        {score}/100
      </span>
      <span className="text-[11px] text-[#616D66]">· {category}</span>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="py-12 px-6 text-center bg-white border border-[#E4E7DF] rounded-xl">
      <AlertTriangle className="w-6 h-6 text-[#C4A36A] mx-auto mb-3" />
      <h3 className="font-display text-sm font-semibold text-[#242B27] mb-1">{title}</h3>
      <p className="text-xs text-[#616D66] max-w-md mx-auto mb-4">{description}</p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="px-4 py-2 bg-[#173F32] text-white text-xs font-medium rounded-lg hover:bg-[#113026] transition-colors cursor-pointer"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
