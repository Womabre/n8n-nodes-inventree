import {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	Icon,
	INodeProperties,
} from 'n8n-workflow';

export class InvenTreeApi implements ICredentialType {
	name = 'invenTreeApi';
	displayName = 'InvenTree API';
	documentationUrl = 'https://docs.inventree.org/en/stable/api/';
	icon: Icon = {
		light: 'file:../nodes/InvenTree/InvenTree.svg',
		dark: 'file:../nodes/InvenTree/InvenTree.svg',
	};
	properties: INodeProperties[] = [
		{
			displayName: 'InvenTree URL',
			name: 'host',
			type: 'string',
			default: '',
			placeholder: 'https://inventree.yourdomain.com',
			description: 'Base URL of your InvenTree server, without /api',
			required: true,
		},
		{
			displayName: 'API Token',
			name: 'apiToken',
			type: 'string',
			typeOptions: {
				password: true,
			},
			default: '',
			description:
				'Create one in InvenTree under User Settings > Security > Access Tokens. The token has the permissions of the user it belongs to.',
			required: true,
		},
	];

	// InvenTree uses Django REST Framework token auth, whose header keyword is "Token", not "Bearer".
	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Token {{$credentials.apiToken}}',
			},
		},
	};

	// The API root (/api/) answers without authentication, so the test calls an
	// endpoint that rejects a bad token.
	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.host.replace(/[/]+$/, "")}}/api',
			url: '/user/me/',
			method: 'GET',
		},
	};
}
