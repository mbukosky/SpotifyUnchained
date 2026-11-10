import { formatMonthDate } from '../lib/wall';

const REGION_NAMES = {
  US: 'United States',
  UK: 'United Kingdom',
  CA: 'Canada',
  BR: 'Brazil',
  MX: 'Mexico',
  DE: 'Germany',
  AU: 'Australia & New Zealand',
};

/**
 * "N Fridays. T tracks. Since Month day, year." — the archive's size is the
 * first thing on the page. The spans only style the numbers; the heading's
 * text reads as the plain sentence.
 */
export default function ScaleHeadline({ numbers, region }) {
  const isAll = region === 'ALL';
  return (
    <div className="scale">
      <h2 className="scale-headline">
        <span><em>{numbers.fridays.toLocaleString('en-US')}</em> Fridays.</span>{' '}
        <span><em>{numbers.tracks.toLocaleString('en-US')}</em> tracks.</span>{' '}
        <span className="scale-since">Since {formatMonthDate(numbers.since)}.</span>
      </h2>
      <p className="scale-sub">
        {isAll
          ? 'Every region, one tile per week. Brighter weeks were archived in more regions.'
          : `New Music Friday ${REGION_NAMES[region] || region}, one tile per week. Brighter tiles hold more tracks.`}
      </p>
    </div>
  );
}
