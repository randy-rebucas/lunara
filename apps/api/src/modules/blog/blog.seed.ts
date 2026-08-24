import type { Collection } from 'mongodb';

export const DEFAULT_BLOG_POSTS = [
  {
    slug: 'how-lunara-pickup-delivery-works',
    title: 'How Lunara Pickup & Delivery Works',
    excerpt: 'From booking to folded laundry at your door — here\'s what happens at each step of a Lunara order.',
    authorName: 'Lunara Team',
    content: `Booking a wash with Lunara takes less than a minute, but a lot happens behind the scenes between your pickup and your delivery. Here's the full journey.

**1. Book your service**
Choose a service type — Wash & Fold, Dry Cleaning, or Express — enter your estimated weight or piece count, and pick a pickup window that fits your day.

**2. We match you with a nearby shop**
Lunara routes your order to a partner laundry shop within your service area, based on availability and capacity, so turnaround stays fast.

**3. A rider picks up your laundry**
A verified rider arrives during your selected window, confirms the bag count with you, and heads to the shop.

**4. Your shop weighs, washes, and quality-checks**
The partner shop logs the actual weight, applies any add-ons you selected (fabric softener, stain treatment, express turnaround), and washes your load through their standard quality process.

**5. Delivery back to you**
Once your order is ready, a rider brings it back to your address. You'll get status updates the whole way — picked up, in progress, ready, out for delivery.

That's it. No drop-off lines, no guessing on price — you see your estimate before you confirm, and the final price reflects the actual weight or pieces processed.`,
    isPublished: true,
  },
  {
    slug: 'wash-fold-vs-dry-cleaning',
    title: 'Wash & Fold vs. Dry Cleaning: Which Does Your Laundry Need?',
    excerpt: 'Not sure which service to book? Here\'s a quick guide to picking the right one for your load.',
    authorName: 'Lunara Team',
    content: `One of the most common questions we get is "which service should I pick?" Here's a simple breakdown.

**Wash & Fold**
Best for everyday items: t-shirts, jeans, underwear, socks, bedsheets, towels. These fabrics tolerate machine washing and drying well, and you'll get them back clean, dried, and neatly folded.

**Dry Cleaning**
Best for delicate or structured garments: suits, blazers, silk, wool, garments with beading or embellishment, and anything with a "dry clean only" tag. These fabrics can shrink, lose shape, or get damaged in a standard wash cycle, so they're treated with solvent-based cleaning instead of water.

**A simple rule of thumb**
Check the care label. If it says "dry clean only," don't risk a regular wash — book Dry Cleaning. If it's a machine-washable everyday item, Wash & Fold will always be the faster, cheaper option.

**Still not sure?**
When in doubt, note it in the "special instructions" field when booking, or message your shop directly — most partner shops are happy to flag anything that looks risky before they start.`,
    isPublished: true,
  },
  {
    slug: 'remove-common-stains-before-pickup',
    title: '5 Common Stains and What to Do Before Your Pickup',
    excerpt: 'A little prep before your laundry gets picked up can make a big difference in the final result.',
    authorName: 'Lunara Team',
    content: `Stains are much easier to treat fresh. While our partner shops handle stain treatment as an add-on, here's what helps in the meantime.

**1. Coffee or tea**
Blot (don't rub) with a clean cloth to lift excess liquid. Avoid hot water, which can set the stain further.

**2. Grease or oil**
Sprinkle a little cornstarch or baby powder on the spot to absorb oil before it sets in. Shake off before your pickup.

**3. Ink**
Ink stains can spread if rubbed, so leave them alone and just flag the item for our stain treatment add-on at booking.

**4. Blood**
Rinse with cold water only, never hot — heat sets protein-based stains like blood permanently.

**5. Sweat/deodorant marks**
Turn the garment inside out if possible so the shop can spot-treat the collar or underarm area directly.

**When in doubt, add stain treatment**
If you're not sure what caused a mark, select the stain treatment add-on when booking and mention the item type in your notes — our partner shops know how to handle most fabric-safe treatments.`,
    isPublished: true,
  },
  {
    slug: 'understanding-your-laundry-price',
    title: 'Understanding Your Laundry Price: Per Kilo, Per Load, and Per Piece',
    excerpt: 'Wondering why prices vary by shop? Here\'s how Lunara pricing modes work.',
    authorName: 'Lunara Team',
    content: `Not all laundry shops price the same way, and Lunara supports a few different pricing modes so shops can charge fairly for the way they operate.

**Per Kilo**
You pay based on the actual weight of your laundry, measured at the shop. This is common for Wash & Fold and works well for mixed loads of everyday clothing.

**Per Machine Load**
Some shops price by the machine load instead of exact weight — useful for shops with fixed-capacity washers. Heavier orders that don't fit in one load are automatically billed as multiple loads.

**Per Piece**
Best suited for Dry Cleaning, where each garment (a blazer, a dress, a pair of trousers) is priced individually rather than by weight, since delicate items are processed one at a time.

**Flat Bag**
A fixed price per standard bag size, regardless of exact weight — good for predictable, budget-friendly pricing on standard loads.

**Why it matters**
Your running estimate during booking already reflects the pricing mode of the shop you selected, so you'll never be surprised — the final price is confirmed once your shop logs the actual weight, load count, or piece count.`,
    isPublished: true,
  },
  {
    slug: 'eco-friendly-laundry-habits',
    title: '5 Eco-Friendly Laundry Habits Worth Adopting',
    excerpt: 'Small changes to how you do laundry can cut water use, energy use, and fabric wear.',
    authorName: 'Lunara Team',
    content: `Laundry is one of the most resource-intensive chores in daily life. Here are a few habits that reduce the footprint without sacrificing clean clothes.

**1. Wash full loads, not half loads**
Combining smaller loads into one full load (within capacity) uses less water and energy per item than running several partial loads.

**2. Cold water when possible**
Most detergents today are formulated to clean effectively in cold water, and skipping the heater cuts a large share of laundry's energy use.

**3. Air dry when you can**
Line-drying or air-drying instead of machine drying not only saves energy — it's gentler on fabric and extends the life of your clothes.

**4. Use the right amount of detergent**
More detergent doesn't mean cleaner clothes — it usually means more rinsing needed and more product washed straight down the drain.

**5. Bundle your pickups**
Scheduling laundry pickups for full loads rather than frequent small ones reduces both trips and per-item processing, which is better for your shop's water and energy use too.

At Lunara, our partner shops are laundry professionals first, so these habits pair well with the service you're already booking — cleaner clothes, less waste.`,
    isPublished: true,
  },
  {
    slug: 'how-to-become-lunara-partner',
    title: 'Own a Laundry Shop? Here\'s How to Become a Lunara Partner',
    excerpt: 'Grow your laundry business with steady order flow, built-in logistics, and simple payouts.',
    authorName: 'Lunara Team',
    content: `If you run a laundry shop and want more predictable, steady business, partnering with Lunara connects you with customers in your area without you needing to manage marketing, riders, or a booking system yourself.

**What Lunara handles for you**
- Customer discovery and booking through the app
- Rider dispatch for pickup and delivery
- Order tracking and customer notifications
- Settlement and payout tracking

**What you focus on**
- Processing orders to your usual quality standard
- Setting your own pricing per service and add-on
- Managing your capacity and service area

**Getting started**
Apply through the Lunara partner application, and our team will review your shop details, service area, and pricing setup. Once approved, you'll get access to the partner dashboard where you can manage services, add-ons, pricing, staff accounts, and view your settlement history.

**Flexible pricing, your rules**
You're not locked into one pricing model — choose per kilo, per load, per piece, or flat bag pricing depending on how your shop operates, and adjust your own add-on lineup (like express turnaround or fabric softener) at any time.

Ready to grow your shop's customer base? Start your partner application today.`,
    isPublished: true,
  },
  {
    slug: 'laundry-care-labels-explained',
    title: 'Laundry Care Labels Explained: A Quick Reference',
    excerpt: 'Those little symbols on your clothing tags aren\'t decoration — here\'s what they actually mean.',
    authorName: 'Lunara Team',
    content: `Care labels can look like a secret code, but the core symbols are easy to learn once you know what to look for.

**The washtub symbol**
A basin with water means machine washable. Dots inside indicate water temperature — more dots, hotter water is safe to use.

**The triangle**
A plain triangle means bleach is safe. A triangle with two lines inside means non-chlorine bleach only. A crossed-out triangle means no bleach at all.

**The square**
Represents drying instructions. A circle inside means tumble dry is safe; dots indicate heat level. Lines inside the square usually mean line-dry or flat-dry instead.

**The iron**
A plain iron icon means ironing is safe. Dots indicate temperature. A crossed-out iron means don't iron this item at all.

**The circle**
A plain circle means dry clean only. A crossed-out circle means do not dry clean — machine wash instead.

**Why this matters for your Lunara order**
If you're ever unsure whether an item needs Wash & Fold or Dry Cleaning, the care label is the fastest way to check. When in doubt, note the item in your booking's special instructions so your partner shop can double check before processing.`,
    isPublished: true,
  },
] as const;

export async function reseedBlogPosts(collection: Collection) {
  const now = new Date();
  for (const post of DEFAULT_BLOG_POSTS) {
    await collection.updateOne(
      { slug: post.slug },
      {
        $set: { ...post, publishedAt: post.isPublished ? now : undefined, updatedAt: now },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true },
    );
    console.log(`  ${post.slug} — ${post.title}`);
  }
}
