# Real pictures for the front tiles

I cannot create photographs here (no image generator, and photo sites are
blocked from my sandbox). The app is ready for them: save a picture with one of
the names below in THIS folder, run `npm run deploy`, and it replaces the
drawing automatically. `.jpg`, `.webp` and `.png` all work. Aim for 1600x900
(16:9), under 300 KB each (squoosh.app shrinks them). No text or logos in the
pictures, and keep the main subject in the middle: on wide screens the top
and bottom are trimmed.

| File        | Where it shows               | Prompt to give an AI image tool |
|-------------|------------------------------|---------------------------------|
| worker      | Worker or Helper tile/banner | Photo of an Indian construction mistri in a hard hat and orange vest laying bricks on a house wall, sunny day, natural light, candid, 16:9 |
| ride        | Ride tile/banner             | Photo of an Indian rider on a motorbike with a passenger sitting behind, both in helmets, city street in Agartala style, slight motion blur, 16:9 |
| shop        | Shop tile/banner             | Photo of a small Indian hardware and paint shop front with shelves of goods and the owner at the counter, daylight, 16:9 |
| eat         | Eat & Stay tile/banner       | Photo of an Indian food delivery rider on a scooter with an insulated food box on the back, moving along a street, warm evening light, 16:9 |
| market      | Buy something tile           | Photo of second-hand household items (wooden chair, small table, bicycle, phone) arranged outside a house in India, daylight, 16:9 |
| partner     | Partner tile                 | Photo of two Indian people looking at a smartphone together and smiling, outdoors, friendly, 16:9 |
| need        | I need card                  | Photo of an Indian person holding a smartphone on a street, searching for help nearby, natural light, 16:9 |
| offer       | I offer card                 | Photo of an Indian shopkeeper or tradesperson ready to serve customers at their small business, welcoming, 16:9 |

Use pictures you own or that are licensed for commercial use, and avoid
recognisable faces of real people you do not have permission to show.

## Matching the two pictures already added

Add this to the end of every prompt so the set looks like the ride photo:
"Candid documentary photograph, Agartala India, natural late-afternoon light,
shallow depth of field, realistic skin and clothing, 16:9, no text, no logos,
no brand names, no number plates."

Already done: worker, ride, shop, eat and market. Still to add:
partner, need, offer. Send them to Claude in the chat and they will be
cropped to 16:9, cleaned of any brand names or plates, shrunk and added.
