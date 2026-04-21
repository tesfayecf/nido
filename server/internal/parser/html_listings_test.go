package parser

import (
	"testing"

	"home-searcher/server/internal/ingestion/domain"
)

func TestHTMLListingsParserParsesPortalListingCards(t *testing.T) {
	t.Parallel()

	parser := NewHTMLListingsParser()
	tests := []struct {
		name      string
		source    domain.Source
		payload   string
		wantID    string
		wantTitle string
		wantURL   string
		wantPrice int64
		wantLoc   string
	}{
		{
			name: "idealista preset",
			source: domain.Source{
				ID:          "idealista-girones",
				EndpointURL: "https://www.idealista.com/ca/venta-viviendas/girona/girones/",
				ConfigJSON:  `{"item_selector":"article.item","title_selector":"a.item-link","url_selector":"a.item-link","price_selector":".item-price","external_id_attribute":"data-element-id","base_url":"https://www.idealista.com","currency":"EUR"}`,
			},
			payload:   `<article class="item" data-element-id="110924150"><a class="item-link" href="/ca/inmueble/110924150/">Pis a Palau, Girona</a><span class="item-price h2-simulated">180.000<span class="txt-big">€</span></span></article>`,
			wantID:    "110924150",
			wantTitle: "Pis a Palau, Girona",
			wantURL:   "https://www.idealista.com/ca/inmueble/110924150/",
			wantPrice: 180000,
		},
		{
			name: "fotocasa preset",
			source: domain.Source{
				ID:          "fotocasa-girones",
				EndpointURL: "https://www.fotocasa.es/es/comprar/pisos/girona-provincia/girones/l",
				ConfigJSON:  `{"item_selector":"article[class*='@container']","title_selector":"h3 a","url_selector":"h3 a","price_selector":"div.flex.items-center.gap-mdp.text-display-3","location_selector":"p.text-body-1","base_url":"https://www.fotocasa.es","currency":"EUR"}`,
			},
			payload:   `<article class="@container w-full"><div class="flex items-center gap-mdp text-display-3"><span>175.000 €</span></div><h3><a href="/es/comprar/vivienda/salt/veinat/189359370/d">Piso de 104 m² en Calle Mossèn Sebastià Puig, Veïnat</a></h3><p class="text-body-1 text-on-surface opacity-75 truncate mt-sm mb-md">Veïnat, Salt</p></article>`,
			wantTitle: "Piso de 104 m² en Calle Mossèn Sebastià Puig, Veïnat",
			wantURL:   "https://www.fotocasa.es/es/comprar/vivienda/salt/veinat/189359370/d",
			wantPrice: 175000,
			wantLoc:   "Veïnat, Salt",
		},
		{
			name: "habitaclia preset",
			source: domain.Source{
				ID:          "habitaclia-girones",
				EndpointURL: "https://www.habitaclia.com/viviendas-en-girones.htm",
				ConfigJSON:  `{"item_selector":"article.js-list-item","title_selector":".list-item-info a","url_selector":".list-item-info a","price_selector":".list-item-price","location_selector":".list-item-location","external_id_attribute":"data-id","base_url":"https://www.habitaclia.com","currency":"EUR"}`,
			},
			payload:   `<article class="js-list-item list-item-container" data-id="28976000007188"><div class="list-item-price">198.000 €</div><div class="list-item-info"><a href="https://www.habitaclia.com/comprar-piso-venta_plaza_de_garaje_en_santa_eugenia-girona-i28976000007188.htm">Piso Calle agudes de les-sta eugenia. Venta piso plaza de garaje en girona</a></div><p class="list-item-location">Girona - Santa Eugenia</p></article>`,
			wantID:    "28976000007188",
			wantTitle: "Piso Calle agudes de les-sta eugenia. Venta piso plaza de garaje en girona",
			wantURL:   "https://www.habitaclia.com/comprar-piso-venta_plaza_de_garaje_en_santa_eugenia-girona-i28976000007188.htm",
			wantPrice: 198000,
			wantLoc:   "Girona - Santa Eugenia",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			items, err := parser.Parse(test.source, []byte(test.payload))
			if err != nil {
				t.Fatalf("parse listings: %v", err)
			}
			if len(items) != 1 {
				t.Fatalf("expected one listing, got %d", len(items))
			}

			item := items[0]
			if test.wantID != "" && item.ExternalID != test.wantID {
				t.Fatalf("expected external id %q, got %q", test.wantID, item.ExternalID)
			}
			if item.Title != test.wantTitle {
				t.Fatalf("expected title %q, got %q", test.wantTitle, item.Title)
			}
			if item.URL != test.wantURL {
				t.Fatalf("expected url %q, got %q", test.wantURL, item.URL)
			}
			if item.PriceAmount != test.wantPrice {
				t.Fatalf("expected price %d, got %d", test.wantPrice, item.PriceAmount)
			}
			if item.Location != test.wantLoc {
				t.Fatalf("expected location %q, got %q", test.wantLoc, item.Location)
			}
		})
	}
}

func TestParseHTMLListingsConfigValidatesRequiredSelectors(t *testing.T) {
	t.Parallel()

	_, err := ParseHTMLListingsConfig(`{"item_selector":"article.item","title_selector":"a.item-link"}`)
	if err == nil {
		t.Fatal("expected config validation error")
	}
}
