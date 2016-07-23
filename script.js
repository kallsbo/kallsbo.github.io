var app = angular.module('contacts', []);

app.service('MessageService', [ function() {
	this.data = {
        'Message': '',
        'MessageClass': '',
        'ShowMessage': false
    };

    this.DisplayMessage = function(message, messagetype) {
    	this.data.Message = message;

        switch(messagetype) {
            case 'error':
           		this.data.MessageClass = 'alert alert-danger';
                break;
			case 'warning':
                this.data.MessageClass = 'alert alert-warning';
                break;
            case 'success':
                this.data.MessageClass = 'alert alert-success';
                break;
            default:
                this.data.MessageClass = 'alert alert-danger';
        };

        this.data.ShowMessage = true;
    };
}]);

app.service('AuthService',['$location', function ($location) {
    this.data = {
        'IsAuthenticated': false,
        'IsCorrectURL': false,
        'IsSecureURL': false,
        'OAuthCallbackURL': '#',
        'OAuthURL': '#',
        'access_token': ''
    };

    this.config = {
      'oAuthEndPoint': "https://accounts.google.com/o/oauth2/auth",
			'oAuthClientID': "632515388751-cissrevhauvovoterd149s3780md7j5v.apps.googleusercontent.com",
			'oAuthScope': "https://www.google.com/m8/feeds"
    };

    this.SetOAuthCallbackURL = function() {
        var a = document.createElement('a');
        a.href = document.referrer;
        this.data.OAuthCallbackURL = ['https://fiddle.jshell.net', a.pathname].join('');
        a = '';
    };

    this.SetOAuthURL = function() {
        // URL Encode parameters
        var redirect_uri = encodeURIComponent(this.data.OAuthCallbackURL);
        var client_id = encodeURIComponent(this.config.oAuthClientID);
        var scope = encodeURIComponent(this.config.oAuthScope);

        // Set oauth url
        this.data.OAuthURL = this.config.oAuthEndPoint + "?client_id=" + client_id + "&redirect_uri=" + redirect_uri + "&scope=" + scope + "&response_type=token";
    };

    this.TokenRecieved = function() {
        // Check url for fragments, access_token
        if(this.GetURLParameter('access_token') != undefined)
        {
            // Store information
            this.data.access_token = this.GetURLParameter('access_token');
            this.data.token_expires = this.GetURLParameter('expires_in');
            this.data.IsAuthenticated = true;
        }
    };

    this.GetURLParameter = function(sParam) {
	    var sPageURL = window.parent.location.hash.substring(1);
    	var sURLVariables = sPageURL.split('&');
    	for (var i = 0; i < sURLVariables.length; i++) {
        	var sParameterName = sURLVariables[i].split('=');
        	if (sParameterName[0] == sParam) {
            	return sParameterName[1];
        	}
    	};
		}

    this.init = function() {
    		// Check if it's the correct url
        if(window.location.href.indexOf('_display') == -1)
        {
        	// Correct url
          this.data.IsCorrectURL = true;
          // Build secure URL for this JSFiddle
        	this.SetOAuthCallbackURL();
        	// Check for correct protocol
        	if($location.protocol() == 'https') {
            // Set secure connection
            this.data.IsSecureURL = true;
            // Check for token
            if(!this.TokenRecieved())
            {
                // Build oauth url
                this.SetOAuthURL();
            }
					}
        }
    }
    this.init();
}]);

app.service('ContactsService',['AuthService', 'MessageService', '$http', function (AuthService, MessageService, $http) {
    this.data = {
    	'DefaultCountry': '',
        'DefaultCountryStats': [],
    		'NumberOfValidContacts': 0,
        'NumberOfInValidContacts': 0,
        'ContactsFeed': {}
    };

    this.LoadContacts = function() {
        $http({
  			method: 'GET',
  			url: 'https://www.googleapis.com/m8/feeds/contacts/default/full/?max-results=9999&alt=json',
            headers: {
                'Authorization': 'Bearer ' + AuthService.data.access_token,
                'GData-Version': '3.0'
            }
		}).then(function successCallback(response) {
    		// this callback will be called asynchronously
    		// when the response is available
            angular.copy(this.CrunchTheNumbers(response.data.feed), this.data.ContactsFeed);
  		}.bind(this), function errorCallback(response) {
    		// Set error message
            MessageService.DisplayMessage(
                'An error occured while trying to fetch the contacts from Google! ' +
                'Error: ' + response.data.error.code + ' - ' + response.data.error.message, 'error');
            // Show logon button again
            AuthService.data.IsAuthenticated = false;
  		}.bind(this));
    };

    this.CrunchTheNumbers = function(inpFeed) {
    	// Loop the feed
        for (i = 0; i < inpFeed.entry.length; i++)
        {
            // Check for null value
            if(inpFeed.entry[i].gd$phoneNumber == undefined) { continue; };

            // Check all numbers
            inpFeed.entry[i].IsAllNumbersValid = this.IsAllNumbersValid(inpFeed.entry[i].gd$phoneNumber);

            // Add statistics
            if(inpFeed.entry[i].IsAllNumbersValid)
            {
                 this.data.NumberOfValidContacts += 1;
            }
            else
            {
                 this.data.NumberOfInValidContacts += 1;
            }
        }

        // Calculate the default country
        // Sort sontries from the one with most numbers -> least numbers
        var countryTopList = Object.keys(this.data.DefaultCountryStats).sort(function(a,b){
            return this.data.DefaultCountryStats[b]-this.data.DefaultCountryStats[a]}.bind(this));

        // Set the default country
        this.data.DefaultCountry = countryTopList[0];
        // Generate valid numbers
        inpFeed = this.GenerateValidNumbers(inpFeed);
        return inpFeed;
    }

    this.IsAllNumbersValid = function(phoneArray) {
    	var retval = true;

        for (j = 0; j < phoneArray.length; j++)
        {
            if(!isValidNumber(phoneArray[j].$t))
            {
                // None valid number found
                retval = false;
            }
            else
            {
                // Valid number
                var con = countryForE164Number(phoneArray[j].$t);

                if(this.data.DefaultCountryStats[con] != undefined)
                {
                    this.data.DefaultCountryStats[con] += 1;
                }
                else
                {
                    this.data.DefaultCountryStats[con] = 1;
                }
            }
        }
        return retval;
    };

    this.GenerateValidNumbers = function(inpFeed) {
    	for (k = 0; k < inpFeed.entry.length; k++)
        {
            // Check for null value
            if(inpFeed.entry[k].gd$phoneNumber == undefined) { continue; };

            inpFeed.entry[k].validNumbers = this.GenerateE164(inpFeed.entry[k].gd$phoneNumber);
        }

        return inpFeed;
    };

    this.GenerateE164 = function(phoneArray) {
        var retval = [];

        // Loop array
        for (i = 0; i < phoneArray.length; i++)
        {
            if(!isValidNumber(phoneArray[i].$t))
            {
                // Not a valid e164 number
                var newNumber = {};
                newNumber.$t = formatE164(this.data.DefaultCountry, phoneArray[i].$t);
                newNumber.uri = 'tel:' + newNumber.$t;
                retval.push(newNumber);
            }
            else
            {
                retval.push(phoneArray[i]);
            }
        }
        return retval;
    };

    this.ChangeDefaultCountry = function() {
    	this.data.ContactsFeed = this.GenerateValidNumbers(this.data.ContactsFeed);
    };

    this.UpdateContacts = function() {
    	// Get the xml
		$http({
            method: 'GET',
            url: 'https://www.googleapis.com/m8/feeds/contacts/default/full/?max-results=9999',
            headers: {
                'Authorization': 'Bearer ' + AuthService.data.access_token,
                'GData-Version': '3.0'
            }
        }).then(function successCallback(response) {
            // this callback will be called asynchronously
            // when the response is available
            // Parse the xml
            var xmlContacts = $.parseXML(response.data);
            console.log(xmlContacts);
            $xml = $(xmlContacts);
            // Loop the contacts
            for (i = 0; i < this.data.ContactsFeed.entry.length; i++)
            {
                console.log($xml.find("id:contains('" + this.data.ContactsFeed.entry[i].id.$t + "')").parent().tostring());
            }

        }.bind(this), function errorCallback(response) {
            // Set error message
            console.log(response);
            // Show logon button again

        }.bind(this));
    };

    if(AuthService.data.IsAuthenticated == true)
    {
        // Load contacts
        this.LoadContacts();
    }
}]);

app.controller("MessageController", ['$scope', 'MessageService', function($scope, MessageService) {
	$scope.data = MessageService.data;
}]);

app.controller("AuthenticateController", ['$scope', 'AuthService', function ($scope, AuthService) {
    $scope.data = AuthService.data;

    $scope.HideHTTPSSwitch = function() {
    	return this.data.IsCorrectURL && !this.data.IsSecureURL ? false : true;
    }
}]);

app.controller("ContactsController", ['$scope', '$http', 'AuthService', 'ContactsService', function ($scope, $http, AuthService, ContactsService) {
    $scope.Auth = AuthService.data;
    $scope.Contacts = ContactsService.data;

    $scope.DeafultCountryChange = function() {
        ContactsService.ChangeDefaultCountry();
    };

    $scope.UpdateContacts = function() {
    	ContactsService.UpdateContacts();
    };
}]);
