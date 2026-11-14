export const businessTables=["wedding_albums", "wedding_photos", "wedding_settings", "wedding_staff", "wedding_rsvps", "wedding_messages"];
export const coordinationTables=["wedding_api_limits", "wedding_api_uploads"];
export const apiFunctions=[
  "wedding_api_assert_staff(uuid)",
  "wedding_api_rate(text,integer,integer)",
  "wedding_api_rsvp(jsonb)",
  "wedding_api_message(jsonb)",
  "wedding_api_messages(integer)",
  "wedding_api_gallery_open()",
  "wedding_api_public_state()",
  "wedding_api_public_photos(uuid,integer)",
  "wedding_api_public_photo(uuid)",
  "wedding_api_admin_photos(uuid,integer)",
  "wedding_api_admin_messages(integer)",
  "wedding_api_admin_state()",
  "wedding_api_mutate(text,uuid,jsonb,uuid)",
  "wedding_api_upload_reserve(jsonb,uuid)",
  "wedding_api_upload_claim(uuid,uuid)",
  "wedding_api_upload_release(uuid,uuid,uuid)",
  "wedding_api_upload_complete(uuid,uuid,uuid)",
  "wedding_api_upload_cancel(uuid,uuid)",
  "wedding_api_cleanup_claim()",
  "wedding_api_cleanup_done(uuid[])"
];
export const activationIndexes=["wedding_api_upload_cleanup", "wedding_api_photo_album_order", "wedding_api_message_order"];
