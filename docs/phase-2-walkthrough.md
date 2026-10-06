# Phase 2 walkthrough: rooms and media

Branch: `phase-2-rooms-media`, created from `phase-1.5-design` because Phase 1.5 isn't merged yet. Not merged, pushed or deployed.

## What was done

### Rooms (`/admin/rooms`, Superuser and Admin)
- Room types list: price, guests, active and archived rooms, photo count, status.
- Create and edit room types: name, URL slug (auto-generated if left blank), description, price per night in whole NPR ("4,500" accepted), max guests, display order, amenities (one per line).
- Archive or reactivate a room type. Nothing is ever deleted.
- Physical rooms for each type: add, rename, archive or reactivate. Names are unique within a type. Archiving a room is blocked while it has a confirmed or checked-in stay that hasn't ended (checked against today in Asia/Kathmandu).
- Room-type photos are ordered on the edit page. The first one is the main photo.

### Media (`/admin/media`, Superuser and Admin)
- **Library:**
  - Upload several photos at once; drag-and-drop works.
  - Each file shows a progress bar.
  - Filters: All / Alt text needs review / Not used.
- **Upload flow:**
  - The server signs each upload. The API secret never reaches the browser; I checked the built client bundles.
  - The browser posts straight to Cloudinary, into the `bagaicha` folder, restricted to JPEG, PNG, WebP and HEIC.
  - The server then asks Cloudinary's Admin API about the upload, and only then writes the database row.
  - Wrong format or over 10 MB → the upload is deleted from Cloudinary and rejected.
  - An asset that isn't in our folder is rejected but **never** deleted, in case it's something else in the account.
- **Delivery:** every image goes through one loader that adds `f_auto,q_auto,c_limit,w_<width>`, capped at 2400 px. Originals are never served.
- **Alt text:**
  - New uploads start empty and flagged "needs review".
  - Saving alt text clears the flag.
  - Placement tiles also show the flag.
- **Delete:**
  - Only works for images that aren't used anywhere; the card lists where an image is used.
  - Deletes from Cloudinary inside the same database transaction, so if Cloudinary fails, the library keeps the row.
- **Gallery** (`/admin/media/gallery`) and **Homepage** (`/admin/media/homepage`):
  - Choose and order photos for each gallery category and homepage slot.
  - Reorder by dragging (mouse, touch or keyboard) or with the ← → buttons. Remove takes a photo out of that place only.
  - "Add images" opens a picker of the whole library.
  - The public site starts reading these in Phase 5.

### Users
- **Your profile** (`/admin/profile`, every user, also linked from your name in the header):
  - Change your own name.
  - Change your password; this needs the current one, and the new one must be entered twice.
  - A password change signs you out everywhere and returns you to sign-in with a notice.
- **Users page** (Superuser): "Edit name & email" for other users. Emails are lowercased and unique. Your own name is edited on your profile.

### Photo seed script
- Run it with `npm run media:seed-photos`. It never runs on build or deploy.
- Each photo gets a fixed ID `bagaicha/seed/<name>`, so it's idempotent:
  - Photos already in the database are skipped.
  - Uploads use `overwrite=false`, so a photo left on Cloudinary by an interrupted run is reused, not duplicated.
- Image processing:
  - HEIC is converted with macOS `sips`, because sharp can't decode HEIC; this is macOS only, like the preview script.
  - sharp then applies EXIF rotation, fits each photo within 2560 px, and strips all metadata, including any GPS location.
  - Maps and the QR code stay PNG; photos become JPEG.
- Alt text is a draft made from the filename (for example "Family room 1") and is flagged for review.
- Skipped: `night-farmhouse.jpg` (your request) and `brochure-front-page-vertical.png` (you said it's a brochure reference, not a website photo). `wedding-mock.png` **is** included, with draft alt "Wedding mock", so review it and keep it out of real event placements. Edit the `SKIP` list at the top of the script to change this.

### Infrastructure
- Migration `media_alt_review` (applied to the dev database) adds `altNeedsReview`, `format`, `bytes` and `originalFilename` to `media`. Existing images with alt text are marked reviewed.
- New dependencies: `@dnd-kit/*` (reordering), `server-only`, and `sharp` (explicit dev dependency for the seed script; same version Next already uses).
- `.env.example` now lists `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` and `CLOUDINARY_API_SECRET` (names only).
- Shared additions: `Textarea` form control, `formatNpr`, `todayInResort`, and a `SubNav` tab component.

## Environment check
`.env.local` has all three Cloudinary names, so nothing is missing. Disclosure: before your "names only" rule arrived, one check read the three values into a shell variable to confirm they weren't empty. Nothing was printed or stored. Since then I've only checked names.

## What I tested
- `npm run typecheck`, `npm run lint` and `npm run build` all pass.
- Cloudinary signing matches the worked example in Cloudinary's docs (offline).
- Delivery URLs get `f_auto,q_auto` and a capped width.
- Built client bundles contain no Cloudinary server code or variable names.
- Room-type validation: commas in prices, no paisa, slug generation, amenity de-duplication, and errors on the right fields.
- Database constraints, in a transaction rolled back on the dev database (nothing persisted):
  - Duplicate slug or room name → handled as a field error.
  - Deleting media removes its placements and keeps the room type.
  - New media is flagged for review by default.
- Seed script `--dry-run`: 18 photos to upload, 2 skipped with reasons, the HEIC file detected and converted, every output under 10 MB.
- EXIF rotation, tested locally on the rotated photo: it comes out upright with metadata stripped. Nothing was uploaded.
- Every new admin route redirects to sign-in when signed out.
- The login page shows the password-changed notice (checked at desktop and phone).
- `/preview` is unchanged: "Open in Google Maps" is kept, and there's no horizontal scroll.

## Not tested (needs you)
- **Signed-in admin UI.** I didn't sign in, as agreed. Please test it with the checklist below.
- **Anything that calls Cloudinary**: real uploads, the Admin API check, blur previews, deletion and the seed script's live run. Per your rules I made no Cloudinary API calls.
- **Cloudinary folder mode.** I couldn't confirm whether your account uses fixed or dynamic folders. The code handles both, but please check that the first upload lands in `bagaicha` in the Cloudinary console.

## Manual test checklist
1. **Rooms:**
   1. Create a room type with a price like `4,500` and leave the slug blank.
   2. Edit it, then try a slug another room type already uses: you should get a field error.
   3. Add rooms `101` and `102`, try `101` again (field error), rename one, then archive and reactivate it.
   4. Archive the room type and check the list shows "Archived".
2. **Upload:**
   1. In Media → Library, upload a JPEG, a PNG and a HEIC from a phone.
   2. Try a file over 10 MB and a PDF; both should be refused before uploading.
   3. Check new images show "Alt text needs review".
3. **Alt text:** save alt text and check the badge disappears.
4. **Placements:**
   1. Add images to a room type, a gallery category and the "Hero (desktop)" slot.
   2. Reorder by dragging, with the arrow buttons, and with the keyboard (focus the grip, press Space, use the arrow keys, press Space).
   3. Reload and check the order stuck.
5. **Delete:**
   1. Try to delete a placed image: Delete is disabled, with the reason.
   2. Remove it from its placements, delete it, and check it's gone from the Cloudinary console.
6. **Seed:**
   1. Run `npm run media:seed-photos -- --dry-run`, then `npm run media:seed-photos`.
   2. Run it again; it should report everything as already present.
   3. Review the draft alt text in the library.
7. **Profile:**
   1. Change your name and check the header updates.
   2. Change your password with a wrong current password (error), then correctly. You should be signed out and see the notice.
8. **Users (Superuser):** edit a Staff user's name and email, then try an email another user already has (error).
9. **Permissions:** sign in as Staff. Rooms and Media shouldn't be in the nav, and `/admin/rooms` and `/admin/media` should go to the "forbidden" page. Profile should work.

## Notes and limits
- The library and the picker load every image, with no pagination. That's fine for hundreds of photos; we can add paging if the library grows much larger.
- Homepage slots don't limit how many photos each slot holds. Phase 5 decides how each slot uses them (for example, the hero uses the first).
- Phase 3: confirming a booking must also check the room is still active, because archiving a room and confirming a booking could happen at the same time. Login rate limiting is also planned for Phase 3; the password-change form doesn't have its own rate limit yet.
- The public pages don't use any of this data yet (Phase 5).

## Open questions
1. OK to skip `brochure-front-page-vertical.png` in the seed and include `wedding-mock.png` (flagged)?
2. Should a homepage slot be limited to one photo (for example, the hero), or allow several?
