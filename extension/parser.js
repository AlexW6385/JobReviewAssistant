class WaterlooParser {
    static parse(text) {
        const data = {
            title: null,
            location: null,
            duration: null,
            salary: null,
            apply_url: null,
            skills: []
        };

        // Helper: safe extraction
        const getBetween = (start, stops, limit = 5000) => {
            const sIdx = text.indexOf(start);
            if (sIdx === -1) return null;
            const contentStart = sIdx + start.length;
            let end = contentStart + limit;
            for (const stop of stops) {
                const stopIdx = text.indexOf(stop, contentStart);
                if (stopIdx !== -1 && stopIdx < end) end = stopIdx;
            }
            return text.substring(contentStart, end).trim();
        };

        // 1. Title
        data.title = getBetween("Job Title:", ["Note:", "Job Openings:", "Level:"], 100);

        // 2. Location (Robust Fallback)
        let parsedLoc = "";

        const city = getBetween("Job - City:", ["Job -", "Job Location"], 100);
        const province = getBetween("Job - Province/State:", ["Job -", "Job Location"], 100);
        const country = getBetween("Job - Country:", ["Job -", "Job Location"], 100);

        // Handle weird long header for generic locs
        const genericLoc = getBetween("Job Location (If Exact Address Unknown or Multiple Locations):", ["Job -", "Employment Location"], 150)
            || getBetween("Job Location:", ["Job -", "Employment Location"], 150);

        if (city && city.length > 2) {
            parsedLoc = city;
        } else if (genericLoc && genericLoc.length > 2) {
            parsedLoc = genericLoc;
        } else if (province) {
            parsedLoc = `${province}${country ? `, ${country}` : ''}`;
        }

        const arrangementRaw = getBetween("Employment Location Arrangement:", ["Work Term Duration:", "Special Work"], 100);
        let arrangement = null;
        if (arrangementRaw) {
            const lower = arrangementRaw.toLowerCase();
            if (lower.includes('hybrid')) arrangement = 'Hybrid';
            else if (lower.includes('remote') || lower.includes('virtual')) arrangement = 'Remote';
            else if (lower.includes('in-person') || lower.includes('site')) arrangement = 'In-person';
        }

        if (parsedLoc) {
            data.location = parsedLoc + (arrangement ? ` (${arrangement})` : "");
        } else {
            data.location = arrangement ? arrangement : "Local";
        }

        // 3. Duration (Strict)
        const rawDuration = getBetween("Work Term Duration:", ["Special Work Term", "Job Summary"], 200);
        if (rawDuration) {
            const durMatch = rawDuration.match(/(\d+\s*(?:month|week)s?(?:\s*work\s*term)?)/i);
            if (durMatch) {
                data.duration = durMatch[1];
                if (rawDuration.toLowerCase().includes("prefer")) {
                    data.duration += " (Preferred)";
                }
            } else {
                data.duration = rawDuration.split('\n')[0].substring(0, 30);
            }
        }

        // 4. Salary (Smart Heuristics)
        const compSection = getBetween("Compensation and Benefits:", ["Targeted Degrees"], 1000) || "";
        let salaryFound = null;

        // 1. Explicit Hourly
        const hourlyRegex = /(?:\$|USD|CAD)?\s*(\d{1,3}(?:[,]\d{3})*(?:\.\d{2})?)\s*(?:USD|CAD)?\s*(?:per hour|\/hr)/i;
        const hourlyMatch = compSection.match(hourlyRegex);
        if (hourlyMatch) {
            salaryFound = `$${hourlyMatch[1]}/hr`;
        } else {
            // 2. Inference (Avoid years like 2025, 2026)
            const moneyMatches = compSection.matchAll(/(?:\$|USD|CAD)?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*(?:USD|CAD)?/gi);
            for (const m of moneyMatches) {
                const rawVal = m[1].replace(/,/g, '');
                const val = parseFloat(rawVal);
                if (isNaN(val)) continue;
                if (val < 15) continue;
                // Filter years: 1990-2030 are usually invalid for salary unless explicit
                if (val >= 1990 && val <= 2030) continue;

                let interval = "?";
                if (val < 150) interval = "/hr";
                else if (val > 20000) interval = "/yr";
                else if (val > 2000 && val < 10000) interval = "/mo";

                salaryFound = `$${m[1]}${interval}`;
                break;
            }
        }
        data.salary = salaryFound || null;

        if (!data.salary) {
            const globalMatch = text.match(/\$[\d,.]+\s*-?\s*\$[\d,.]+/);
            if (globalMatch) data.salary = globalMatch[0];
        }

        // 5. Apply URL (Prioritized Match)
        data.apply_url = null;

        let urlSearchStart = text.indexOf("If By Website, Go To:");
        if (urlSearchStart === -1) {
            urlSearchStart = text.indexOf("Application Information");
        }

        if (urlSearchStart !== -1) {
            const chunk = text.substring(urlSearchStart, urlSearchStart + 2000);
            const match = chunk.match(/(https?:\/\/[^\s"'<>]+)/i);
            if (match) {
                data.apply_url = match[1];
            }
        }

        // 6. Tech Stack (Massive Expansion)
        data.skills = [];
        const skillsSection = getBetween("Required Skills:", ["Eligible applicants must:", "Compensation and Benefits"], 5000)
            || getBetween("Qualifications:", ["Eligible applicants must:", "Compensation and Benefits"], 5000);

        if (skillsSection) {
            const keywords = [
                // === Languages ===
                "Python", "Java", "C++", "C", "C#", "JavaScript", "JS", "TypeScript", "TS", "HTML", "CSS", "SQL", "NoSQL",
                "Go", "Golang", "Rust", "Swift", "Kotlin", "PHP", "Ruby", "Matlab", "R", "Scala", "Dart", "Lua", "Perl",
                "Haskell", "Elixir", "Erlang", "Clojure", "F#", "Groovy", "Julia", "Assembly", "Bash", "Shell", "PowerShell",
                "VBA", "Objective-C", "Solidity",

                // === Frameworks ===
                "React", "React.js", "React Native", "Angular", "Vue", "Vue.js", "Next.js", "Nuxt.js", "Svelte",
                "Node", "Node.js", "Express", "NestJS", "Django", "Flask", "FastAPI", "Spring", "Spring Boot",
                "ASP.NET", ".NET", ".NET Core", "Entity Framework", "Rails", "Ruby on Rails", "Laravel", "Symfony",
                "CodeIgniter", "GraphQL", "Apollo", "Tailwind", "Bootstrap", "Material UI", "Chakra UI", "Sass", "Less",
                "jQuery", "Ember", "Backbone", "Redux", "MobX", "Flutter", "Ionic", "Xamarin", "Cordova", "Electron", "Swing", "JavaFX", "WPF", "Qt",

                // === Databases ===
                "PostgreSQL", "Postgres", "MySQL", "MariaDB", "SQLite", "Oracle", "SQL Server", "MSSQL",
                "MongoDB", "Mongo", "Cassandra", "Redis", "Elasticsearch", "DynamoDB", "Firestore", "Firebase",
                "CouchDB", "Neo4j", "Realm", "Supabase",

                // === Cloud & DevOps ===
                "AWS", "Amazon Web Services", "Azure", "GCP", "Google Cloud", "Heroku", "Vercel", "Netlify", "DigitalOcean",
                "Docker", "Kubernetes", "K8s", "Terraform", "Ansible", "Puppet", "Chef", "Vagrant",
                "Jenkins", "GitLab CI", "CircleCI", "Travis CI", "GitHub Actions", "TeamCity", "Bamboo",
                "Git", "GitHub", "GitLab", "Bitbucket", "SVN", "Mercurial",
                "Nginx", "Apache", "Kafka", "RabbitMQ", "ActiveMQ", "SQS", "SNS",

                // === AI / Data ===
                "Pandas", "NumPy", "SciPy", "Matplotlib", "Seaborn", "Scikit-learn", "Sklearn",
                "PyTorch", "TensorFlow", "Keras", "Opencv", "NLP", "LLM", "GPT", "Bert", "Hugging Face",
                "Spark", "Hadoop", "Databricks", "Snowflake", "BigQuery", "Redshift", "Tableau", "Power BI", "Looker",
                "Airflow", "dbt", "Excel",

                // === Tools & Testing ===
                "Jira", "Confluence", "Trello", "Asana", "Notion", "Slack", "Teams", "Zoom",
                "Figma", "Sketch", "Adobe XD", "Photoshop", "Illustrator",
                "Selenium", "Cypress", "Playwright", "Jest", "Mocha", "Chai", "Junit", "TestNG", "Pytest", "RSpec",
                "Postman", "Insomnia", "Swagger", "OpenAPI",
                "Linux", "Unix", "Ubuntu", "CentOS", "RedHat", "Windows", "MacOS", "Android", "iOS", "Unity", "Unreal Engine"
            ];

            const lowerSection = skillsSection.toLowerCase();
            data.skills = keywords.filter(k => {
                const escaped = k.replace(/[.+^${}()|[\]\\]/g, '\\$&');
                if (k === 'C++') return lowerSection.includes('c++');
                if (k === 'C#') return lowerSection.includes('c#');
                if (k === '.NET') return lowerSection.includes('.net');
                if (k === 'Go') return lowerSection.match(/\bgo\b/);
                if (k === 'C') return lowerSection.match(/\bc\b/) && !lowerSection.includes('c++') && !lowerSection.includes('c#');

                const regex = new RegExp(`\\b${escaped.toLowerCase()}\\b`, 'i');
                return regex.test(lowerSection);
            });
            data.skills = [...new Set(data.skills)];
        }

        return data;
    }
}
