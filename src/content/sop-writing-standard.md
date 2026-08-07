# SOP Writing Standard

**Status: draft v0.1. Not yet approved.**

This is the house standard for writing and editing SOPs in the knowledge base. It applies to every
platform and every category.

If you are writing a new SOP, start at section 2. If you are editing an existing one, start at
section 8. Read section 1 once — everything after it is rules and examples.

# 1. Why the rules are what they are

An SOP is not read by a person. Three consumers use it, in this order.

**First, the search that finds it.** The driver's message is compared against the SOP by meaning. If
the SOP is written in our words and the driver writes in theirs, the SOP is never found, and nothing
else about it matters.

**Second, the agent that reads it.** It receives the SOP, picks the right branch, and decides what to
do. It cannot ask us what we meant, and it cannot see the driver's order, app or account.

**Third, the driver who gets the answer.** Over WhatsApp, in Portuguese, Urdu or Hindi, on a phone,
usually mid-shift.

Two facts about how the system works drive most of the rules below.

**The whole SOP is stored as one unit.** There is one search entry per SOP, not one per section. So
an SOP about seven different things is a single blurred entry that matches none of them well. This
is why one SOP covers one subject.

**Every word in the body feeds the search entry.** There is no separate summary field — the body
text is what gets matched. This is why boilerplate openings, repeated titles and metadata stay out
of the body.

# 2. The shape of an SOP

## 2.1 Format

Use plain structured text. Headings for blocks, dashes for bullets, numbers for ordered steps. No
XML or HTML tags. No tables inside the SOP body.

The reason: the body is stored as plain text and every word in it affects how the SOP is found.

Do not repeat the title inside the body. The title is a separate field and is already included when
the SOP is indexed.

Do not open SOPs with a stock sentence copied between them. Identical text at the top of many SOPs
pulls their search entries toward each other, which makes it more difficult to search.

**Don't:** This SOP describes the correct procedure for riders to follow when… (copied at the top
of every SOP)
**Do:** Start straight in with the first block. The shared sentence says nothing about this SOP,
and every word of it makes this SOP look more like all the others.

## 2.2 The blocks

Fixed set, fixed order, exact names. Do not invent blocks. Do not reorder them.

- **Driver says** — required. Two to four real phrasings drivers use for this problem.
- **Environment** — required. The precise facts that make this the right SOP.
- **Ask first** — procedures only. What the agent must find out before choosing a branch.
- **Resolution** — required. What to do. Branches if there is more than one path. Where the exact
  wording of a reply matters, an example reply sits inline in its branch — see section 5.
- **Cause** — optional. Why it happens. Only when the agent must diagnose. See 4.12.
- **Metadata** — required. Risk, entry, supersedes, related, review date.

Leave a blank line between blocks. Nothing goes before the first block.

## 2.3 The skeleton

Copy this shape.

    Driver says
      "[real phrasing 1]"
      "[real phrasing 2]"
      "[real phrasing 3]"

    Environment
      [platform] · [vehicle] · [city or zone]
      [order or trip state]
      [any other fact that decides whether this SOP applies]

    Ask first
      1. [question the agent must ask to pick a branch]
      2. [question]

    Resolution
      A. [condition]
         [steps]
         Example reply: "[message, only where the wording is fragile]"

    B. [condition]
         [steps]

    Metadata
      platform: [name] · category: [name]
      risk: [none | performance | deactivation]
      entry: [driver message | proactive | both]
      supersedes: [SOP ids this replaces, if any]
      related: [SOP ids]
      reviewed: [YYYY-MM-DD] · owner: [team or person]

## 2.4 Three types of SOP, three shapes

Not every entry in the knowledge base is a procedure. Use the right shape.

**Procedure.** The driver has a problem right now and there is more than one possible path.
Complaints, incidents, app failures. Uses all blocks.

**Coaching.** No incident — we are teaching something. Best practice, efficiency, how a feature
works. Uses everything except Ask first, and usually has no branches. A procedure also teaches — a
rule stated inside a Resolution branch is coaching in place, and that is not a reason to write a
separate coaching entry. Coaching is the shape for entries with no incident at all.

**Reference.** A fact lookup: venue locations, zone notes, opening hours. These are not procedures
and must not be written as if they were. Use this shorter shape:

    Driver says
      "where is [venue] in [mall]"

    Location
      Floor: [floor]
      Unit: [unit code]
      Landmark: [what it is next to]

    Links
      [directions url]
      [map url]

    Metadata
      platform: [name] · category: [name]
      reviewed: [YYYY-MM-DD] · owner: [team or person]

## 2.5 Categories and tags

- Categories are internal only — the agent never sees them. What reaches the agent is the product
  type, the platform and the tags, so those are the fields that must be right. The category exists
  to organize the knowledge base for us.
- Category is a closed list. Use one that already exists. Creating a new category is an ops decision.
- The platform tag is mandatory and must match the category's platform.
- Function tags are used by workflows to call a specific SOP directly.
  Do not invent one, and do not rename one.

# 3. Write in the driver's language

This is the highest-impact rule in the document. An SOP that is not phrased like the driver's message
is difficult to find.

## 3.1 The title

The title is the first thing indexed and carries a lot of weight in whether the SOP is found. Write
it as the driver's situation, in the driver's words.

**Don't:** Teaching riders best practice - the 4 golden rules
**Do:** The 4 rules to follow on every order

**Don't:** Issues with monthly earnings calculations or a lack of understanding of their monthly earnings
**Do:** My monthly earnings don't add up

Rules for titles:

- No internal vocabulary. No "SOP", no "best practice", no "teaching riders", no acronym the driver
  has never seen.
- Simplify the words, not the facts. Keep whatever separates this SOP from its neighbours — "My
  earnings don't look right" collides with the per-order fee SOP and the how-to-check-earnings SOP
- Keep the timing. A preventive coaching entry stays phrased as prevention — "How to prove you
  delivered every order", not "The customer says they never got the order". The reactive phrasing
  is a different SOP: the incident one.
- If two SOPs would have nearly the same title, they are probably the same SOP. See 8.2.
- The title says what the driver's problem is, not what we are doing about it.

## 3.2 Driver says

Two to four alternative phrasings, in the driver's words. The title already carries the main one, so
do not repeat it here.

    Driver says
      "the drink leaked, order is damaged"
      "will I have to pay for this order?"
      "my bag opened and the food went everywhere"

Rules:

- Two to four. More phrasings do not keep helping, and past a point they blur what the
  SOP is about.
- Keep the driver's grammar. Do not tidy it. "i cant find the resturant" is a better entry than
  "I am unable to locate the restaurant".

## 3.3 Words to never use in driver-facing text

The agent presents as a real human support agent. These words break that: SOP, ticket, issue log,
escalate, topic, prompt, system, knowledge base, AI, bot, workflow, category, flagged.

Also avoid idioms such as  "hang tight" or "sit tight"; sarcasm; British informality
such as "brilliant" or "cheers"; and anything that will not survive translation into Portuguese, Urdu
or Hindi.

## 3.4 Exact strings, one name per thing

Write button labels, screen names, statuses and error messages exactly as the app shows them:
"Order delivered", not "the delivery confirmation". The exact string is what the driver quotes, and
an exact string matches where a paraphrase does not.

Pick one name per concept and keep it across the whole knowledge base. The same thing under two
names is two half-strength search entries.

# 4. Writing the Resolution

These rules come from technical-procedure writing standards — nuclear and aviation procedure
writing.
They exist so a reader cannot take a step the wrong way.

## 4.1 One action per step, present tense, imperative

Start the step with the verb. One action. Singular. Present tense.

**Don't:** Riders should be contacting Rider Support Chat and they will need to send a photo
**Do:** Message Rider Support Chat. Send a photo of the damage.

**Don't:** The rider will have to check the address
**Do:** Check the delivery address.

Test: does the step start with a verb the driver can do right now?

## 4.2 Name the object of the verb

Never leave the object to inference. No "it", no "this", no "that one".

**Don't:** Zip it up before you ride
**Do:** Zip the bag closed before you ride

**Don't:** Check it against the app
**Do:** Check the building number against the app

## 4.3 Use the simplest word that is accurate

- utilise → use
- commence → start
- request clarification from the customer → ask the customer
- in the event that → if
- proceed to the customer's location → go to the customer

Test: would a driver with basic English understand it first time, after translation?

## 4.4 No sub-sub-actions

One level of nesting only. If a step needs steps, which need steps, the deepest part is a separate
SOP.

Don't:

    1. Handle the spill
       a. Contact support
          i.  Take a photo
          ii. Attach it

Do:

    1. Message Rider Support Chat.
    2. Send a photo of the damage.
    3. Continue to the customer.

## 4.5 Three or more objects go in a list

If a verb takes three or more objects, break them out. Do not run them together in a sentence.

Don't:

    Check the customer's name, order number, building, floor and door number before handing it over.

Do:

    Check before handing the order over:
    - name
    - order number
    - building
    - floor
    - door number

## 4.6 Combine verbs that share an object

If two actions happen to the same thing at the same time, they are one step.

**Don't:** 1. Check the delivery note. 2. Read the delivery note.
**Do:** Check and read the delivery note.

If the actions are separated in time, or something can go wrong between them, keep them apart.

## 4.7 Conditions use IF, WHEN and THEN in capitals, on their own line

Every condition gets its own line. The condition word is capitalised so it cannot be skimmed past.

Don't:

    If the order is cash order and the customer won't pay then contact Rider Support Chat.

Do:

    IF the order is a cash order
    AND the customer refuses to pay
    THEN message Rider Support Chat.

Only IF, WHEN, AND, OR and THEN carry conditions. Never "unless", "except", "but" or "otherwise" —
they hide the condition mid-sentence. Rewrite as an IF line.

**Don't:** Continue to the customer unless the order was cancelled.
**Do:**
    IF the order was cancelled
    THEN stop and message Rider Support Chat.
    IF the order is still open
    THEN continue to the customer.

## 4.8 Do not join two different conditions with AND or OR on one line

The rule is about what the condition is about.

Two subjects with one thing being said about them — join them inline:

    IF the drinks or the soup are not upright

Different subjects with different tests — separate lines:

Don't:

    IF the order is cash and the customer is not answering the phone

Do:

    IF the order is cash
    AND the customer does not answer the phone

Test: if you cannot answer each line with yes or no on its own, split it.

Never AND and OR in the same condition — the grouping is ambiguous and will be read both ways. If a
branch genuinely needs both, list the conditions:

    IF all of the following are true:
    - the order is cash
    - the customer does not answer
    - you are at the address
    THEN message Rider Support Chat.

## 4.9 Write conditions positively

Negative conditions are misread far more often than positive ones. Rephrase.

**Don't:** IF the address is not correct
**Do:** IF the address is wrong

**Don't:** IF the customer is not responding
**Do:** IF the customer is silent

The rewrite must mean exactly the same thing. "IF the rider has not contacted Rider Support Chat"
cannot become "IF the rider still needs to contact them" — a rider who contacted them and got no
answer still needs to, so the two conditions differ. Where no exact positive equivalent exists,
keep the negative.

## 4.10 Numbered for order, bulleted for no order

- A numbered list means these happen in this order, and the order matters.
- Bullets or a checklist mean these all apply, in any order.

## 4.11 Branch labels

Where there is more than one path, label branches A, B, C and lead with the condition. Put the
highest-consequence branch first, not in the order the situations occur.

    Resolution
      A. [the dangerous case]
         ...
      B. [the common case]
         ...

A label is a condition the agent can settle from the Ask first answers. Plain, precise words — not
the rider's phrasing, which belongs in Driver says, and not a heading.

**Don't:** A. Scenario 1 — says nothing about when the branch applies.
**Don't:** A. Premature order cancellation — a noun-phrase heading, and jargon.
**Do:** A. The order was cancelled before reaching the customer

Ordering: in the worked example in section 9, the cancelled branch leads because it can end the
Rider ID, even though riding-with-a-spill is the common case and cancelling happens last in time.

## 4.12 Cause — only when the agent must diagnose

Include Cause only when the driver's stated problem is probably not the real one, and the agent has
to work it out across several messages. If the SOP is a list of steps, a Cause block just repeats
them.

Keep it for "traffic is making me late" — the real causes are usually route choice, toll avoidance or
missed turnings, and the agent needs those to ask the right questions.

Drop it for "how do I log out of the app".

## 4.13 A check states what a pass looks like — and what to do on a fail

"Check the order status" is not a step; it has no answer. Say the state that counts as a pass, and
give the failing case its own condition.

**Don't:** Check the order status.
**Do:**

    Check that the order status shows "Delivered".
    IF it shows anything else
    THEN message Rider Support Chat.

Test: could the agent tell from the driver's reply whether the step passed? If the SOP does not say
what happens on a fail, the agent improvises it.

## 4.14 Warnings come before the step, and contain no actions

A warning is a statement of what goes wrong, placed immediately before the step it guards — never
after it, and never inside it. The reverse also holds: never hide an action inside a warning, a
note, or a parenthesis. If it says to do something, it is a numbered step.

**Don't:** 2. Message Rider Support Chat (make sure you have already taken a photo).
**Do:**

    Cancelling at this point can terminate your account, the first time.
    1. Take a photo of the damage.
    2. Message Rider Support Chat.

# 5. Driver-facing text

What to say normally lives in the Resolution: a step like "Tell the driver that Rider Support will
unassign the order" is an instruction like any other, and the agent phrases the message itself. Do
not write out a reply for every branch.

Where a badly phrased message can cost the driver money, standing or trust — consequence warnings,
liability refusals, anything with risk: deactivation — add an example reply after that branch's
steps, on a line starting "Example reply:" so it cannot be read as a step or as something the
driver said. Write it as a real message, not a description of one: an example steers the agent
better than instructions.

The example answers the branch at its starting point and covers the advice the steps give. The
agent adapts it to wherever the driver actually is — a driver who has already messaged Rider
Support Chat is not told to message them again.

The rules below apply to every driver-facing sentence, wherever it lives — an example reply or a
"tell them ..." step.

- One or two short WhatsApp bubbles. Not a paragraph.
- Short sentences. One idea per sentence.
- No internal vocabulary. See 3.3.
- Links go on their own line as bare web addresses. WhatsApp does not render formatted links — a
  markdown-style link arrives on the driver's phone exactly as typed, brackets and all.
- Emphasis uses WhatsApp syntax: an asterisk either side of the words. Use it rarely, for the one
  thing that matters.

Example, inside a branch:

    B. Still riding, order still open
       1. Continue to the customer.
       2. Tell the customer there was a spill.
       3. Message Rider Support Chat.
       4. Send a photo of the damage.
       Example reply: "Okay. Still take it to the customer and tell them
       there was a spill. Message Rider Support now and send them a photo."

**Consequences yes, threats no.** We can tell a driver that something affects their account or
standing, because it is true and they need to know.

**Don't:** We can see you went offline for 40 minutes.
**Do:** I noticed the app showed you offline for a while — was something wrong?

# 6. Metadata

Until these become real database fields, they live as text at the bottom of the body. Bottom, not
top: the field labels are identical in every SOP, and identical text near the top of the body drags
all the search entries toward each other — the same problem as the stock opening sentence in 2.1.

    Metadata
      platform: Deliveroo · category: Rider Complaints
      risk: deactivation
      entry: driver message, or proactively from performance data
      supersedes: 433 section (1), 923
      related: 313, 314
      reviewed: 2026-08-06 · owner: ops

- **risk** — one of none, performance, or deactivation. Use deactivation only where the driver can
  lose their account. This is meant to be rankable, so be strict with it.
- **entry** — can the agent open this conversation itself, from performance data, or only answer it
  when the driver raises it?
- **supersedes** — what this replaces. Mandatory when splitting or merging. See section 8.
- **reviewed** — the date a human last confirmed the content is still true.

# 7. Checklist before publishing

Adapted from the KCS Article Quality Index. Every item is a defect if unchecked, not a preference.

**Content**

- SOP does not already exist.
- It covers exactly one subject. If it needs "(1) … (7)", it is several SOPs.
- The title is the driver's situation, in the driver's words.
- Driver says holds two to four real phrasings taken from real conversations.
- Environment is precise and uses the same terms as the driver context.

**Writing**

- Every step starts with a verb and contains one action.
- Every verb names its object.
- Conditions use capitalised IF, WHEN and THEN, one condition per line.
- No condition hides behind "unless", "except" or a parenthesis, and no line mixes AND with OR.
- Conditions are positive wherever possible.
- Every check says what a pass looks like, and what to do on a fail.
- No action hides inside a warning or a note.
- App names, statuses and error messages appear exactly as the app shows them.
- Numbered where order matters, bulleted where it does not.
- Simple words throughout, and it survives translation.

**Driver-facing**

- Any example reply is one or two short messages, and it earns its place: the wording is fragile.
- No internal vocabulary anywhere a driver can see.
- Links are bare web addresses on their own line, and they resolve today.
- Consequences are stated without threatening.

**Structure and upkeep**

- The correct shape is used for the type: procedure, coaching or reference.
- Category and tags are set, from the existing list.
- Any attached image adds to the text rather than replacing it. The agent cannot see images, only
  their description, so an SOP whose real content sits inside a screenshot is an empty SOP.

# 8. Editing existing SOPs

## 8.1 Splitting one SOP into several

When an SOP covers more than one subject:

1. Write each subject as its own SOP, in full.
2. Put the old SOP's id in the supersedes field of each new one.
3. Retire the old one. Do not leave it in place — two SOPs on one subject compete with each other,
   and the agent will get whichever one wins by accident.

## 8.2 Two SOPs on the same subject

They compete, and the one that wins is arbitrary. Merge them:

1. Keep the better-written one, or write a new one from both.
2. Carry over anything the other one had that the winner did not.
3. Retire the loser and record it in supersedes.

## 8.3 Two SOPs that contradict each other

Stop and raise it. Do not pick the one that sounds right. A contradiction between two SOPs is usually
a real disagreement about policy, and resolving it silently inside a document is how the wrong answer
becomes official.

## 8.4 Changing a policy fact

Anything affecting a driver's money, account standing or safety needs ops sign-off before it is
written. Fixing the wording of a policy is a writing change. Changing what the policy says is not.

# 9. Worked example

A procedure SOP, complete, following every rule above.

    Title:  Food spilled in my bag on an order

    Driver says
      "the drink leaked, the order is damaged"
      "will I have to pay for this order?"
      "my bag opened and the food went everywhere"

    Environment
      motorbike · thermal bag
      Order collected, not yet delivered · cash or paid

    Ask first
      1. Are you still riding, or are you with the customer?
      2. Have you messaged Rider Support Chat? When?
      3. Is the order still open, or was it cancelled?

    Resolution
      A. The order was cancelled before reaching the customer
         Cancelling after a spill and before reaching the customer
         looks to Deliveroo like the driver ate the food. It can terminate
         the Rider ID immediately, the first time.
         Find out WHY it was cancelled before coaching anything.
         IF the driver chose to cancel
         THEN state the rule once, plainly.
         IF Rider Support Chat told them to cancel
         THEN log it.

    B. Still riding, order still open
         1. Continue to the customer.
         2. Tell the customer there was a spill.
         3. Message Rider Support Chat.
         4. Send a photo of the damage.
         Example reply: "Okay. Still take it to the customer and tell them
         there was a spill. Message Rider Support now and send them a photo."
         "Please don't cancel it before you get there - that looks bad on
         your account even when the spill wasn't your fault."

    C. Delivered, then reported
         Confirm a photo was sent. Nothing further.

    D. The driver asks who pays for the order
         Do not answer this. Send them to Rider Support Chat with the photo.
         Example reply: "I can't say what they'll charge, but send Rider
         Support a photo of the damage and ask them directly."

Note what the rules forced. The dangerous branch comes first, not in the order events happen. The
condition that decides everything — was it cancelled? — is asked explicitly, because the agent cannot
see the order. And the liability question is refused rather than answered.

# 10. One-page summary

**Shape.** Driver says, Environment, Ask first, Resolution — with example replies inline where the
wording is fragile — Cause if needed, Metadata.

**Title.** The driver's problem, in the driver's words.

**Language.** Two to four real phrasings taken from real conversations. Simple words. Short
sentences. It must survive translation. No internal vocabulary anywhere a driver can see.

**Steps.** One action per step. Start with the verb. Name the object. IF, WHEN and THEN in capitals,
one condition per line — never "unless" or "except", never AND mixed with OR. Positive conditions.
Every check says what a pass looks like and what to do on a fail. Warnings before the step, actions
never inside them. Numbered means ordered; bullets mean unordered. Three or more objects go in a
list. One level of nesting only.

**Scope.** One SOP, one subject, one page. If it needs "(1) … (7)", it is several SOPs.

**Afterwards.** Edits do nothing until the search index is rebuilt.
