<script setup>
import Icon from '../components/Icon.vue';
import KeyHint from '../components/KeyHint.vue';
import TopNav from '../components/TopNav.vue';
const terms = [
  [
    '1. Introduction and accepting the terms',
    [
      'Welcome to draw battle! By using this website you agree to these Terms of Service, which include the Privacy Policy below. You also confirm that you are 13 years of age or older, and that if you are under the age of majority in your jurisdiction, your legal guardian has reviewed and agrees to these Terms.',
    ],
  ],
  [
    '2. Acceptable use',
    [
      'Do not use the website to spam, harass, or share offensive content with other players, and do not attempt to disrupt the service or other players\' games.',
    ],
  ],
  [
    '3. Modifications and terminations',
    [
      'These terms may change from time to time and take effect immediately when changed. We may suspend or terminate access to the website at any time.',
    ],
  ],
  [
    '4. Disclaimers and limitations of liability',
    [
      'The website is provided "as is" and "as available". Use of the website is at your own risk. To the extent permitted by law, we are not liable for any damages arising from your use of the website.',
    ],
  ],
  [
    '5. User content',
    [
      'Drawings, guesses, and names are visible to other players in the same game. We are not responsible for content created by other players.',
    ],
  ],
  [
    '6. Contact',
    ['Questions about these terms can be sent by e-mail to the address listed on the website.'],
  ],
];
const privacy = [
  [
    '',
    ['This page explains what information is collected when you use this website and how it is used.'],
  ],
  [
    '1. Log data',
    [
      'Like most websites, our servers may record information your browser sends, such as your IP address, browser type and version, and the pages you visit.',
    ],
  ],
  [
    '2. Local storage',
    [
      'We store small pieces of data in your browser (for example your player name and sound preference) so the game can remember your settings.',
    ],
  ],
  [
    '3. Security',
    [
      'We try to protect your information, but no method of transmission over the internet or method of electronic storage is completely secure.',
    ],
  ],
  [
    '4. Changes to this policy',
    ['We may update this policy from time to time. Continued use of the website means you accept the updated policy.'],
  ],
];
</script>

<template>
  <div class="tos-root">
    <TopNav><router-link to="/" class="nav-home"><Icon name="home" />back to home<KeyHint k="h" /></router-link></TopNav>
    <div>
      <h2 class="tos-header">Terms of Service</h2>
      <div v-for="(s, i) in terms" :key="i">
        <div v-if="s[0] !== ''" class="tos-section-header">{{ s[0] }}</div>
        <div v-for="(p, j) in s[1]" :key="j" class="tos-paragraph">{{ p }}</div>
      </div>
    </div>
    <div>
      <h2 class="tos-header">Privacy Policy</h2>
      <div v-for="(s, i) in privacy" :key="i">
        <div v-if="s[0] !== ''" class="tos-section-header">{{ s[0] }}</div>
        <div v-for="(p, j) in s[1]" :key="j" class="tos-paragraph">{{ p }}</div>
      </div>
    </div>
  </div>
</template>
