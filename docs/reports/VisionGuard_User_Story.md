# User Story

## 2.1 Camera & Video Feed Management

An operator can start a live feed from a webcam or IP camera to begin surveillance, or upload a recorded video file for processing instead. Once a feed is active, the operator can stop it at any time to end monitoring. While a feed is running, the operator can view the latest processed frame to confirm the system is capturing and enhancing footage as expected. If a feed fails to start or an uploaded file is invalid, the operator is informed rather than left with a silently broken stream.

## 2.2 Motion Detection & ROI Extraction

While a feed is active, the system continuously monitors incoming frames for motion. If no motion is present, the frame passes through untouched and no dehazing is performed, keeping CPU usage low. When motion is detected, the system extracts only the region of interest containing that motion rather than processing the entire frame, so enhancement effort is spent only where something is actually happening.

## 2.3 Hybrid Dehazing Pipeline

When a region of interest is flagged for enhancement, the system recovers a clear view of that region even under hazy or smoggy conditions. It estimates how haze has affected the scene using the Dark Channel Prior and an averaged estimate of atmospheric light, then a Tiny CNN refines that estimate before the clean image is reconstructed and merged back into the original frame. The operator sees a visibly clearer region within the live or uploaded footage, without the rest of the frame being altered or the system needing a GPU to keep up in real time.

## 2.4 Event Logging

Whenever motion triggers a dehazing pass, the system automatically logs the event with its timestamp, a snapshot image, the event type, and the coordinates of the region of interest. The operator does not need to manually record anything — every enhanced region of interest becomes a retrievable record for later review.

## 2.5 Timeline / Event Browser

An operator can open the Events page to browse previously logged events in chronological order. Each entry shows its snapshot and details, letting the operator quickly scan through what the system flagged over a given period without replaying full video footage.

## 2.6 Natural Language Event Search

Instead of manually filtering through the timeline, an operator can type a plain-English query, such as "any motion last night?", into the search field on the Events page. The query is parsed into structured filters such as a time range or event type, and the matching logged events are returned and displayed using the same event cards as the timeline view. If the system cannot determine a specific time range from the query, it returns all events rather than failing the search.

## 2.7 System Health Monitoring

An operator can check the current system status at any time to confirm the camera feed and dehazing pipeline are running correctly. This gives the operator confidence that surveillance is active and functioning before relying on it, rather than discovering a failure only after footage was missed.
