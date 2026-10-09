# Test results

Run: 2026-10-09T12:50:55.805Z

**46/46 passed**

| # | Test | Result |
|---|---|---|
| 1 | Budget: 2 people, 35 -> every option <= 35 | PASS |
| 2 | Vegetarian: 1 of 2 -> each option has a vegetarian main | PASS |
| 3 | Not spicy: no dish with spice>0 | PASS |
| 4 | Multi-constraint: budget 40 + 25min + vegetarian + not spicy | PASS |
| 5 | Allergy nuts: no nut dish, no unknown-allergen dish | PASS |
| 6 | Time limit 10 min -> minutes <= 10 | PASS |
| 7 | Unavailable item never recommended | PASS |
| 8 | Conflict: budget 5 for 2 people -> no options, reason budget | PASS |
| 9 | Conflict: 3 vegetarians but no veg mains available -> reason | PASS |
| 10 | Empty constraints do not crash and return options | PASS |
| 11 | Price: total computed from menu, client price ignored | PASS |
| 12 | Quantities 2 x 3.0 + 1 x 2.5 = 8.5 | PASS |
| 13 | Invalid quantities rejected (0, -1, 1.5, 999, "2") | PASS |
| 14 | Non-existent item id rejected | PASS |
| 15 | Unavailable item order rejected | PASS |
| 16 | Empty order rejected | PASS |
| 17 | Missing table rejected | PASS |
| 18 | ETA grows with kitchen load | PASS |
| 19 | ETA uses slowest dish | PASS |
| 20 | API-failure fallback parses "2 people 35 AZN vegetarian 20 min" | PASS |
| 21 | Fallback parser: ambiguous text changes nothing | PASS |
| 22 | Chat: "remove the drink" removes only drinks from the order | PASS |
| 23 | Chat: applyOps ignores unknown ids and unavailable adds | PASS |
| 24 | Chat: question about a dish returns verified facts incl. unknown allergens | PASS |
| 25 | Chat: new request replaces budget (no stale constraints in fallback) | PASS |
| 26 | Chat: "2 people, 40 AZN, not spicy" is a recommendation, not a dish question | PASS |
| 27 | Solver: asking for other options never repeats an option already shown | PASS |
| 28 | Solver: the 3 options are different (distinct main combos, not all same starter) | PASS |
| 29 | Solver: preference "fish" puts a fish dish in the first option | PASS |
| 30 | Solver: when every valid option was already shown -> reason "exhausted" | PASS |
| 31 | Solver: options include more than just mains (drink/starter/dessert suggested) | PASS |
| 32 | Fallback chat (AZ): "adama 1 porsion olsun" -> recommend for 1 person | PASS |
| 33 | Fallback chat (AZ): "salam" -> friendly greeting, no menu dump | PASS |
| 34 | Fallback chat (AZ): "başqa variant göstər" keeps constraints and asks for others | PASS |
| 35 | Fallback chat (RU): "2 человека, 30 манат" parsed | PASS |
| 36 | Fallback chat: "iki nəfər, 40 manat, balıq istəyirəm" -> 2 people, 40, prefers fish | PASS |
| 37 | Fallback chat: add by name ("add 2 lemonade") creates a valid add op | PASS |
| 38 | AI (mock): model JSON is parsed; hallucinated item ids and unknown allergens are dropped | PASS |
| 39 | AI (mock): invalid intent from the model defaults safely to "recommend" | PASS |
| 40 | AI (mock): Gemini returns 500 -> the second provider (Groq) answers | PASS |
| 41 | AI (mock): every provider down -> fallback still answers and the reason is recorded | PASS |
| 42 | AI (mock): garbage (non-JSON) model output does not crash the chat | PASS |
| 43 | AI (mock): recommendation text comes from the model but prices still come from code | PASS |
| 44 | AI (mock): explain falls back to a friendly template (AZ) when the model is down | PASS |
| 45 | Menu chat (mock AI): edit keeps row uid + photo, adds new dish with clean allergens, never wipes table | PASS |
| 46 | Image field: https + small data:image accepted; javascript:, html, http rejected | PASS |
