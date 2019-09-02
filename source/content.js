import options from './options-storage';
import * as icons from './icons';

let token;
const __DEV__ = true;
const endpoint = 'https://api.github.com/graphql'
const issueUrlRegex = /^[/]([^/]+[/][^/]+)[/](issues|pull)[/](\d+)([/]|$)/;
const stateColorMap = {
	open: 'text-green',
	closed: 'text-red',
	merged: 'text-purple'
};

function anySelector(selector) {
	const prefix = document.head.style.MozOrient === '' ? 'moz' : 'webkit';
	return selector.replace(/:any\(/g, `:-${prefix}-any(`);
}

function esc(repo) {
	return '_' + repo.replace(/[./-]/g, '_');
}

function lightOrDark(color) {

  // Variables for red, green, blue values
  var r, g, b, hsp;
  
  // Check the format of the color, HEX or RGB?
  if (color.match(/^rgb/)) {

      // If HEX --> store the red, green, blue values in separate variables
      color = color.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*(\d+(?:\.\d+)?))?\)$/);
      
      r = color[1];
      g = color[2];
      b = color[3];
  } 
  else {
      
      // If RGB --> Convert it to HEX: http://gist.github.com/983661
      color = +("0x" + color.slice(1).replace( 
      color.length < 5 && /./g, '$&$&'));

      r = color >> 16;
      g = color >> 8 & 255;
      b = color & 255;
  }
  
  // HSP (Highly Sensitive Poo) equation from http://alienryderflex.com/hsp.html
  hsp = Math.sqrt(
  0.299 * (r * r) +
  0.587 * (g * g) +
  0.114 * (b * b)
  );

  // Using the HSP value, determine whether the color is light or dark
  if (hsp>127.5) {

      return 'light';
  } 
  else {

      return 'dark';
  }
}

function query(q) {
	q = `query {${q}}`;
	if (__DEV__) {
		console.log(q);
	}

	return q.replace(/\s{2,}/g, ''); // Minify
}

function join(iterable, merger) {
	return [...iterable.entries()].map(merger).join('\n');
}

function buildGQL(links) {
	const repoIssueMap = new Map();
	for (const {repo, id} of links) {
		const issues = repoIssueMap.get(repo) || new Set();
		issues.add(id);
		repoIssueMap.set(repo, issues);
	}

	return query(
		join(repoIssueMap, ([repo, issues]) =>
			esc(repo) + `: repository(
				owner: "${repo.split('/')[0]}",
				name: "${repo.split('/')[1]}"
			) {${join(issues, ([id]) => `
				${esc(id)}: issueOrPullRequest(number: ${id}) {
          __typename
					... on PullRequest {
            state
          }
          ... on PullRequest {
            title
          }
          ... on PullRequest {
            author {
              avatarUrl
            }
          }
          ... on PullRequest {
            labels(first: 100) {
              edges {
                node {
                  name
                }
              }
            }
          }
          ... on PullRequest {
            labels(first: 100) {
              edges {
                node {
                  color
                }
              }
            }
          }
					... on Issue {
            state
          }
          ... on Issue {
            title
          }
          ... on Issue {
            author {
              avatarUrl
            }
          }
          ... on Issue {
            labels(first: 100) {
              edges {
                node {
                  name
                }
              }
            }
          }
          ... on Issue {
            labels(first: 100) {
              edges {
                node {
                  color
                }
              }
            }
          }
				}
			`)}}
		`)
	);
}

function getNewLinks() {
	const newLinks = new Set();
	const links = document.querySelectorAll(anySelector(`
		:any(
			.mod-content
		)
		a[href^="https://github.com/"]:any(
			a[href*="/pull/"],
			a[href*="/issues/"]
		):not(.ILS)
	`));
	for (const link of links) {
		link.classList.add('ILS');
		let [, repo, type, id] = link.pathname.match(issueUrlRegex) || [];
		if (id) {
			type = type.replace('issues', 'issue').replace('pull', 'pullrequest');
			newLinks.add({link, repo, type, id});
		}
  }
  if (__DEV__) {
    console.log("links: ");
    console.log(newLinks);
  }
	return newLinks;
}

async function apply() {
	const links = getNewLinks();
	if (links.size === 0) {
		return;
	}

	for (const {link, type} of links) {
		link.insertAdjacentHTML('beforeEnd', icons['open' + type]);
	}

	const query = buildGQL(links);
	const response = await fetch(endpoint, {
		method: 'POST',
		headers: {
			Authorization: `bearer ${token}`
		},
		body: JSON.stringify({query})
	});
  const {data} = await response.json();


	for (const {link, repo, id} of links) {
		try {
      console.log(data)
      const item = data[esc(repo)][esc(id)];
      console.log(item);
      const state = item.state.toLowerCase();
      const title = item.title;
			const type = item.__typename.toLowerCase();
      link.classList.add(state);
      const svg = link.querySelector('svg');
      var truncate = 60;
      if (title.length < truncate) {
        truncate = title.length;
      }
      link.classList.add("github-issue");
      link.textContent = "";
      var titleElement = document.createElement("span");
      titleElement.className = "title";
      titleElement.textContent = repo + '#' + id + ' ' + title.substring(0, truncate);
      link.appendChild(titleElement);
      link.appendChild(svg);
      if (item.author.avatarUrl != "") {
        var img = document.createElement("img");
        img.src = item.author.avatarUrl;
        img.height = 20;
        img.width = 20;
        img.className = "assigned avatar";
        link.appendChild(img);
      }
      if (item.labels.edges.length > 0) {
        var div = document.createElement("div");
        div.className = "labels"
        link.appendChild(div);
      
        for (const edge of item.labels.edges) {
          
          var label = document.createElement("span");
          label.textContent = edge.node.name;
          label.className = "label";
          label.style.backgroundColor = "#" + edge.node.color;
          if (lightOrDark(label.style.backgroundColor) == "light") {
            label.style.color = "black";
          } else {
            label.style.color = "white";
          }
          div.appendChild(label);
        }
      }
      svg = link.querySelector('svg');
      svg.classList.add(stateColorMap[state]);
			if (state !== 'open' && state + type !== 'closedpullrequest') {
				svg.outerHTML = icons[state + type];
			}
		} catch (error) {
      console.error(error);
    }
	}
}

function onAjaxedPages(cb) {
	cb();
	//document.addEventListener('ajaxComplete', cb);
}

function onNewComments(cb) {
	cb();
  const description = document.querySelector('.issue-container');
  console.log(description);
	if (description) {
		// When new comments come in via ajax
		//new MutationObserver(cb).observe(description, {childList: true, subtree: true});
    // create an observer instance
    var observer = new MutationObserver(cb);
    // configuration of the observer:
    var config = { attributes: true, childList: true, characterData: true };
    // pass in the target node, as well as the observer options
    observer.observe(description, config);
  }
}

async function init() {
	({token} = await options.getAll());
	if (token) {
		onAjaxedPages(() => onNewComments(apply));
	} else {
		console.error('GitHub Issue Link Status: you will need to set a token in the options for this extension to work.');
	}
}

init();
