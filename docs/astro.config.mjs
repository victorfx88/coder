// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
	integrations: [
		starlight({
			title: '',
			description: 'Documentation for Coder',
			logo: {
				src: './src/content/docs/images/icons/coder.svg'
			},
			social: {
				github: 'https://github.com/coder/coder',
				discord: 'https://discord.gg/coder',
				'x.com': 'https://x.com/coderhq',
			},
			locales: {
				root: {
				  label: 'English',
				  lang: 'en',
				},
			},
			sidebar: [
				// {
				// 	label: 'About',
				// 	items: [
				// 		// Each item here is one entry in the navigation menu.
				// 		{ label: 'About Coder', slug: 'README' },
				// 	],
				// },
				{
					label: 'Install',
					collapsed: true,
					autogenerate: { directory: 'install' },
				},
				{
					label: 'User Guides',
					collapsed: true,
					autogenerate: { directory: 'user-guides' },
				},
				{
					label: 'Administration',
					collapsed: true,
					autogenerate: { directory: 'admin' },
				},
				{
					label: 'Contributing',
					collapsed: true,
					autogenerate: { directory: 'contributing' },
				},
				{
					label: 'Guides',
					collapsed: true,
					autogenerate: { directory: 'guides' },
				},
				{
					label: 'Reference',
					collapsed: true,
					autogenerate: { directory: 'reference' },
				},
			],
		}),
	],
});
