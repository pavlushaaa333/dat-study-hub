'use strict';
// Forward recovery sessions before the regular app initializes. Never log or store this URL.
if(new URLSearchParams(location.hash.slice(1)).get('type')==='recovery')location.replace('/password-reset'+location.hash);
