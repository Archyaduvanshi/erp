import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import { publicRequest } from '../../api/publicApi';
import { SectionHeading } from './LandingShared';

const money = value => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(value);
const limit = value => value == null ? 'Contact us for capacity' : Number(value).toLocaleString('en-IN');
export default function PricingSection() {
  const [cycle, setCycle] = useState('monthly');
  const plans = useQuery({ queryKey: ['public', 'plans'], queryFn: () => publicRequest('plans'), staleTime: 0, refetchOnMount: 'always', retry: false });
  const visiblePlans = Array.isArray(plans.data) ? plans.data : [];
  if (!plans.isPending && !visiblePlans.length) return <section id="pricing" hidden />;
  return <section id="pricing" className="landing-section"><div className="landing-container"><div className="landing-pricing-heading"><SectionHeading eyebrow="THE RIGHT FIT FOR YOUR INSTITUTION" title="Flexible plans for every institution">Compare active plans and included modules. Trials start on the platform’s configured default plan; contact us to arrange a different subscription.</SectionHeading><div className="landing-billing-toggle" role="group" aria-label="Billing period">{['monthly', 'yearly'].map(value => <button key={value} type="button" aria-pressed={cycle === value} onClick={() => setCycle(value)}>{value === 'monthly' ? 'Monthly' : 'Yearly'}</button>)}</div></div>
    {plans.isPending ? <div className="landing-three-column" aria-label="Loading plans" role="status">{[1, 2, 3].map(i => <div className="landing-plan-skeleton" key={i}><span /><span /><span /></div>)}</div> : <div className="landing-plans">{visiblePlans.map(plan => <article className="landing-plan" key={plan.publicCode}><span className="landing-plan-state">Available plan</span><h3>{plan.name}</h3><p className="landing-plan-price">{money(cycle === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice)}<span> / {cycle === 'monthly' ? 'month' : 'year'}</span></p><p className="landing-small-note">{money(cycle === 'monthly' ? plan.yearlyPrice : plan.monthlyPrice)} / {cycle === 'monthly' ? 'year' : 'month'} also available</p><dl><div><dt>Students</dt><dd>{limit(plan.maxStudents)}</dd></div><div><dt>Teachers</dt><dd>{limit(plan.maxTeachers)}</dd></div><div><dt>Plan trial period</dt><dd>{plan.trialDays > 0 ? `${plan.trialDays} days` : 'No trial'}</dd></div></dl><ul>{plan.features.map(feature => <li key={feature}><Check size={15} aria-hidden="true" />{feature}</li>)}</ul><a href="#contact" className="landing-button secondary">Contact Sales</a></article>)}</div>}
  </div></section>;
}
