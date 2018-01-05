<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
	<meta charset="utf-8"> <!-- utf-8 works for most cases -->
	<meta name="viewport" content="width=device-width"> <!-- Forcing initial-scale shouldn't be necessary -->
	<meta http-equiv="X-UA-Compatible" content="IE=edge"> <!-- Use the latest (edge) version of IE rendering engine -->
	<title></title> <!-- The title tag shows in email notifications, like Android 4.4. -->

	<!-- Web Font / @font-face : BEGIN -->
	<!-- NOTE: If web fonts are not required, lines 9 - 26 can be safely removed. -->
	
	<!-- Desktop Outlook chokes on web font references and defaults to Times New Roman, so we force a safe fallback font. -->
	<!--[if mso]>
		<style>
			* {
				font-family: sans-serif !important;
			}
		</style>
	<![endif]-->
	
	<!-- All other clients get the webfont reference; some will render the font and others will silently fail to the fallbacks. More on that here: http://stylecampaign.com/blog/2015/02/webfont-support-in-email/ -->
	<!--[if !mso]><!-->
		<!-- insert web font reference, eg: <link href='https://fonts.googleapis.com/css?family=Roboto:400,700' rel='stylesheet' type='text/css'> -->
	<!--<![endif]-->

	<!-- Web Font / @font-face : END -->
	
	<!-- CSS Reset -->
    <style type="text/css">

		/* What it does: Remove spaces around the email design added by some email clients. */
		/* Beware: It can remove the padding / margin and add a background color to the compose a reply window. */
        html,
        body {
	        margin: 0 auto !important;
            padding: 0 !important;
            height: 100% !important;
            width: 100% !important;
        }
        
        /* What it does: Stops email clients resizing small text. */
        * {
            -ms-text-size-adjust: 100%;
            -webkit-text-size-adjust: 100%;
        }
        
        /* What is does: Centers email on Android 4.4 */
        div[style*="margin: 16px 0"] {
            margin:0 !important;
        }
        
        /* What it does: Stops Outlook from adding extra spacing to tables. */
        table,
        td {
            mso-table-lspace: 0pt !important;
            mso-table-rspace: 0pt !important;
        }
                
        /* What it does: Fixes webkit padding issue. Fix for Yahoo mail table alignment bug. Applies table-layout to the first 2 tables then removes for anything nested deeper. */
        table {
            border-spacing: 0 !important;
            border-collapse: collapse !important;
            table-layout: fixed !important;
            Margin: 0 auto !important;
        }
        table table table {
            table-layout: auto; 
        }
        
        /* What it does: Uses a better rendering method when resizing images in IE. */
        img {
            -ms-interpolation-mode:bicubic;
        }
        
        /* What it does: A work-around for iOS meddling in triggered links. */
        .mobile-link--footer a,
        a[x-apple-data-detectors] {
            color:inherit !important;
            text-decoration: underline !important;
        }
      
    </style>
    
    <!-- Progressive Enhancements -->
    <style>
        
        /* What it does: Hover styles for buttons */
        .button-td,
        .button-a {
            transition: all 100ms ease-in;
        }
        .button-td:hover,
        .button-a:hover {
            background: #555555 !important;
            border-color: #555555 !important;
        }

        /* Media Queries */
        @media screen and (max-width: 600px) {

            .email-container {
                width: 100% !important;
                margin: auto !important;
            }

            /* What it does: Forces elements to resize to the full width of their container. Useful for resizing images beyond their max-width. */
            .fluid,
            .fluid-centered {
                max-width: 100% !important;
                height: auto !important;
                Margin-left: auto !important;
                Margin-right: auto !important;
            }
            /* And center justify these ones. */
            .fluid-centered {
                Margin-left: auto !important;
                Margin-right: auto !important;
            }

            /* What it does: Forces table cells into full-width rows. */
            .stack-column,
            .stack-column-center {
                display: block !important;
                width: 100% !important;
                max-width: 100% !important;
                direction: ltr !important;
            }
            /* And center justify these ones. */
            .stack-column-center {
                text-align: center !important;
            }
        
            /* What it does: Generic utility class for centering. Useful for images, buttons, and nested tables. */
            .center-on-narrow {
                text-align: center !important;
                display: block !important;
                Margin-left: auto !important;
                Margin-right: auto !important;
                float: none !important;
            }
            table.center-on-narrow {
                display: inline-block !important;
            }
                
        }

    </style>

</head>
<body bgcolor="#FFF" width="100%" style="Margin: 0;">
    <center style="width: 100%; background: #FFF;">

        <!-- Visually Hidden Preheader Text : BEGIN -->
        <div style="display:none;font-size:1px;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;mso-hide:all;font-family: sans-serif;">
            (Optional) This text will appear in the inbox preview, but not the email body.
        </div>
        <!-- Visually Hidden Preheader Text : END -->

        <!-- Email Header : BEGIN -->
        <table cellspacing="0" cellpadding="0" border="0" align="center" width="600" style="margin: auto;" class="email-container">
			<tr>
				<td style="padding: 20px 0; text-align: center">
					<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMgAAAAoCAYAAAC7HLUcAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAHWgAAB1oBx8yg4AAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAABIjSURBVHic7Z17fNTFtcC/Z3bz2t1AFBS1VdErtBXLK5sAVkV8Fl+QbAJi5ZarrbUWpL7wilVTBKG1txbptYoWrC/UvBRRtLYSaYuS3SQCYouioKKiPKpmd0Oyu3P6RwiEkMdushHFfP8Jmd/MOee3n5w9M2fODNBDDz300EMPnUEOtAGdZdSqazLq3ZFRAoWKjFAkXZQ0wIhovYpEwG5VlTJxxl6sHnTPxgNtcw9fPfZzkMyA79sxq5nh3DL/F27NqsIMj5PcYE7xSgRtrcuw6mknGsMcK3hF6IXSqwOpMVW2i9GdIubuTM/nD1Yc9+CueMzJqhmfFYk4sxFN6ItERXfaiN3pEvfOnSMf/TyRsQCHBAp7RySardaYRMd2FivU1mWXVrb2uaf7fccbYw7pDr0SIxbazDomFMeat2cEfCOMkheSPrfgXRjpDt1N9F57ySGR+vpZNhr7v12jntrc/JmzZWerPCEiAzMqxw2sy336/e40rCXuVDtLles9gYIxQUoqmj8b8to133CY6KOi8m1F+wnQugvth0OEfqj0U9Xffv555k1D1k4tWjP494s7GhiJOp5G9LRE30NUcDgd1LMLt7/gY0X/YYSXhdTHar1Ltnc0vkHtEtSMTVRvVzAKHn/h6UGKX27e7vH7pioswNruUSzg7q8zQzB3n2ZlCHCj2+44IqT8T1tfmF3mrbFp0U93lQsy2hjnC8Dm5o/3cxCEJShzHeKcCfy0W4xqBferF/VDuQp4N+iSVc2fDV87bSo2ehPKUdq1zykDOMZh5a7ha67+iURMXpX3dx+12Vvoi8rHIkxLRIlaPBh7KCr9QEcIjFUlX2mY5wn4HrHobWFvWZt6rZgrjdqBiejcbfAM0LMR/QEqnyQ0Uk0kuJm/7/cucErjP+RSMTQkblMcOExFy6awt/R+d5VvFDDFU+V7N0jpbUnXq4jb71qEMBphfnhEybKWXfabOhy2vtATDtm3EbJiDh24a3jZu0k3rBXcAd+dKNcrcmU4p+Q+ALTIDF+34yGUC4DecYiJABEEJ0pqHP3fxUQvqv7uH9a2YdN6VdLCOaUnxP0irfHW2DT3p+6JoNOB4aDbFfOjcE7J012S2wJ3pe9BhB9aMcfWeYvfS4pMv+9xYGIoYlycXFyXDJlxE7gixa07nwU9W+HycE7pomSK9/jz5ygyU5GSsPekiUjRfmFyvznutkHFQZA7gVSnlZuTaVBbZAYm9VXlSuD9sEsWA2QHrkgZvnb7c6qMZ3/nUIWPEd4W+IdRucsKV6BcrMI4LJOMcrmKLEBllSqbQD9h/0nZsRJzPp/92vRTuvUFByyvD+WUPBTylnoVfqJIuqDl7oDvh92q96uOd2Eko77BB7wmcK+7ynduskS7/PmXKzIT5W/hoGdya84BrU2xgJCpv8etqdepMiXd75u3K6f0nWQZ1hpWG2YIeFS4gUHFDQAxZ9piB4wG0vd0VD5D2C7KEiPmkcDg+RvaFfzkWcfgwElqxtZh3+jfH6dMNmongPTR3U6nwpGCXTK05uenvjbsd5u77y0BQcOULsyoLHgd0RdEWZjpz99Ym1P2j2SqURP7ymYnW7L9lKW1GasKLzAp9lUsT7pX550WGlG+pisy3ZV53we5F+ENZ1raOHLbTtq0niXxPhNGmQekOIRbumJMR3iqCw8DrgLeC2eYRQDDXpt2mQhjtck5hM+B18FcWj14wYCqoQtuCQzpwDkUwRF5AI1uZFftuzXvrFtas2HdwKpN66fZhsjlwL+A2saufFNM7IVRq67J6MZX3UNdbskqrEwCUq3I//NkoSOpCurtQeMgAHUnF3+AmPMAxWGezagcd3RnZbkrC4ci5kmQT2JGz/ts8GP/bq9/m2nEUCjzPoQPUC7t9apvQGcN6giN2RsAtwpzGVTckB34+ZEi3C5wKI1TovdF5brqwQsGVw+dvyzubIag+F4+BzGnI2wFOQLRfKL6eM3mf95ZvWH9rxBuUPSDxu70r/fYX3fXe7YkPKJkmSIlKEM8x2v+F6X3q0rIW7wOFR/KYUaczx0SKIxnTboPGZXjjkb0WUCxsfPiWV+3nWcf8+AuUeYCzpije6JIZmBSX9i99ugdXgygaXYBcCRISBV/lIi3asjdD3Q6zed7aSWvVwwBWYywHchE5DiMzq9+c+0Vn+zceQFCAIihtmD4+qu6tiBPALXyWwBV2+MgcRDKLfkrMAUY1KD2Kd4amxbv2ENf/UEvY5zPgB6GSGG807R2N6KCWeEHgPeASzxVed+J15h4sRq5AcgUYS4Dltd710z/FqrfE/gcsU/WDOkzau2QexNKV7ZKEZaCl6ahsSsR+bixUXuBDPtgx4fl697ecKWqPAf0kpjjd13WFyd1ucWvgnwIZkxSBZuUg2qK1ZxQTukSFb0VON39qet+NI5qkMAVKfWOXaUog1EuC3lL/hyvvvZ3agcsr1fkDsCh1iQ1imSuzusD+lPg/WDv8CIAK/Z/Ue1lRR6qHvz7y9rKLHSagr+VEtPpKE2bdQL0j0Qbnqp5841rER5W1XOG1vw8K6l620JQ0DdBD2d9YTxp6R6AsLdstoreA0z2+PN/2W5nRdzsWAichchNodzSRxLR1WEpQ1gOXQRsAiZ6/HknJSK8PawxjdFDdR4Dltfv/iYYh0h5zeC7r06Wnv2YUPEEqr8GPtvTJnwTE32++qMN14FZ6hA7udv0t0T4BBBPfVz7PPFhDq5FemuEa3dOB3leRW5x+fMvb6ufK5B/K8oUFb0n5C35VaJ6Oq718S6MKMwGjGJuTVRBazRGD64C3g8eUvdHgGGvT80GebPXjj5TkqGjXSa8fCci/9ynTTmBYMPs/9rw0URr9fFut2Gv3kMBG/xsW7vZlB5aMKYimlHfMAGoEeQ+V6XvwpZd3H7fJEFuQ1kWfsfRqS/duIrhwsEdDylsBArcq/OGdEZRc6yY62kePYDadFknDbvOqBhTFO2q/LgwOgnVD/f8LqRgKSx2ftanZviCbV+IDYqAnAi8z5iKpL13mhw8+yDtsf2UpbUqej6wRYRHXX7fsKZn7sqCM4E/KbwSipoJLYsh4yW+atExFVFBZwEixhR1RlETmYFJfVWYCmxpih4AGwcsqK/yLgx3RXZC5FVsxsiKfdpEj8JGvpDqAYCM6vwRoEeJEPeisYd9CXvLPpKYOQ+ICrIsI1B4jMefdxKipcA7Dmsv6kqJTNzl1KFNjseAfymMc1UVZndWoSVyrYBHYE/0OGDEKEL5eG+DCGjSyhk6wliZDSCqf0qmXJWDN4vVGsGRxW8Ikg/ax6h9TjHPAnUxa8bWjijf0RXZrZaatMqE4hh+3yzgMYnZImC/OV9HZK7O62NVG6NHYwr5wDKhYiMloz8G6destTelZxyL76VuLdJ0+Qtmgp4p8HSyS026A7dTb8fvS+70V8QalT/V5hS3XxURB8GckgpPwDdDlfkARsypoRHFm7oqN34HAULe7z7hDqy7GeGCDH9hbl1OcWUi463DcR2qmQIzD3j0aMI4VmDt4GYtmah+G+geB1kxJd3tCf4SdAbCW0Lqj7pFT7IRvS7pMlWjtrHkp8sOklUzPisS5cdAA+BUtdfxZOErnV17NJGQgyBFVvz5RYoUG7WzgO/HO3RP9BA+CNZmHvjosZelNO7ONqVZXVh7bNK1rJnsdjWEJwq1M4BvAYFYJFYYGtXxAaqEiSQ/zXtAyt3j5a2xaZFPHeXAIJT/xmg/VfmN6zg7PwxTuyI6MQcBgt6yUneVbw1wbkZlwcl1uSWrOhwEqJFrgUxRZjImviOvXwzO15FICNUmBxEMR7DnF9ISXXNplFQxmiVolqh+R8Xk0BD+HpAJ/FuV28JuM49Bpd1zAOnrxN5DT6cr/CK8eyPQ5fcdJ/Aztz//vVBOWadr7BJ2EATVAEUC5UZ0FnBWR0MyV+f1sciXMXpAtPenmG3N6rxUUbO5WY9virWBRERKs9SHiqBo0MBfLbLcVd/w2PZTltZ2zej2UTn4NwqbcAd8cxEuEdUHQrllc5raw5vMdHd/eywi89yB/C0hb9ljnZGfuIMA4ezSp90BXxVwpqcy/7RgbtnK9vqrMdcAvQT9xZcqeszK/i4TitdRMto2O1wZwjTbH0E+BI3/YJOIQfU3wEkqXKU2+mxdztNbmootv7g89sGPpzL/KoUbQZ4Phnbsezx8QnEstGbyxe6GcAUqiz2B/I+C3rIVbYhqk045CILqaikSo89YYQ5waltddy+efgZ8FGxwfHmix+yhJyO6jBWnH87OfWqFa2lcOAKgaF04p/QviYj2rMk7SxtMhagUOYyzotsuHPga4wrkn68q84HXU0UuDrW20Trk4RCVhRci9lVVeaozh606fa3M7gPuqwU5xVOVd0Zb/aJRx/VAlgjzvjSLvKJBHox5GKGObc6j0H2+KIL4KrZ0RXxwSPknNqbngIat8mK633d8Fy3uoRmuyvwcUXkC4WOr0fP+7S3+rK2+odzirWLsWCCGcTyXESg8JhFdXbt3SW0RgLXm9tYeZ9WMz1Kaooe5v0u6kkXRoFRSUpehHIOlFqLHsPdYbwwxxclQUzeybIsVczpgHbAifXXhccmQGxfGedCuQdL9vuNFzDNAjJg9P56rqYLZ5f8U1fFNG4m9114S9x1fXXKQUG7588BKgZPdgYJzWj6PRpzX8WWKHnefkEZK2ouIjAScoB/h1LPZm+L9kJgjaacK67zF7xlrzwZSHcauSK/OT376+GtEZmBSXwcsBz0UbEEi06VgbtlKQaYAJ0brd5XHe9iq6zf3qcxq/Klzmh9eyaoZn6WiU4GtX4rocfvQAdT2qkQZSeMVpfWIPkpUxtG4Qg+B3MWEv7QZrjtD7YjyNzGcC2Q6rLzoqr7oqGTKb5WDMYu1qjAjpg1PAwMQfhzKKX8xURHBnJLHVSkCGe3+NONBtKjDv/8uO8juY5AVgNcV8O25DTAaMdcCWegBjh6/HZXB7GG34jArgcFI031Zuo2jer2M0cNBLSr/wva9uztMCGWXrrXCeShHSCxlhSuQf2R36Dlo0SLjSrGPCJysSlHIW9rp2rVwbuksgXtBLnYH1t3RUf+k3P1qpPG0ocAsFDkkUNhbRaYBW0NRszAZOgCYO/wEZmdfy+xhHU9V7hgykDnZdxOu34DITHTv5h+iIaz8kV5yE3AEmI049ayuliW0R523dLVV+T7wDVF5yV1ZeESHgzrJwbYP4vavu0sgH1gUzi2d1VV5QelzNfBn4EZPwNfuOZHOpXlbUOst/rvb7/srcKYrkH9hRGw2kAV6TVKjR339VlJTb0TNTGYP24mYLahuAt4GemM4EqU/ytFY0sEejkjLLwHFspETsxajsTeAjYieSV7Fp0mzsw3qcktWuf2+8cAziH0hc3XeGV2tNj3YcfvzZwBXAytCLpOcq3C9CyMZf7+ooC495W+q3OWpLNgSzC0pa61r0m4Ptyq3AggyR5XpwNZQxHFfsuQDULQ+SMxxGlCHyADQMQiXIcxBmIEyGTgVoT/CEa04B8BGJPVcVOej8go2Jaerad1ECOWU/kWFScCJ1pg/J5JRiZvIwZHF8vgLLgaZB6xNi6WPb7pUMBlsP2VprbXRC0G2qugjGasLR7XWL6kfpNtfsBx0dwGjXhPKKeueG0LuGDIQdSwDPRYkvssOREOoeYsUM5YZ/q08ddrRjF/ZboowaXfztibb75sEPAxalSqOc9rL5cctc/fdvKKcFMwtXZ8EM/fczdutl1cbqQgOL97nFKensnC0in0B2GYjZmTdycUfdIdql983TOBl0Hpj9Xu1I8rfbP48KVOsJixym2l0kORHj+bMXPMmRdlDSeFOkItADwPaStvVIWxDZRGRqtu5mcabUjpwDgCUqCQxyjYnlFO6xOXPdwlyf4PaPwCXdFWmoBFFMA6TvKMEwmsoExF9RLupHkBj3AzsXTAHrkhR3V4CUo/h/O5yDoBwTmmNy18wUWBpzPBHWlSFJD0Ue/y+nylsCCVYntFp7hzsZpdzCoZCkCNB3UAUZBfwHmKfwFP7CFdvTPiPxhXIHw4Q9pZVJ9vsJtyVvktBUkK5JR3+fyUdke73He8QHdnZwrxWUSSjOn+EseJJmswWZNRHVrcs4HRX+qZbMa8keuaos7grC84UbN9gbtkTX4S+HnrooYceeuihh68x/wG3ZnhP2yK8bQAAAABJRU5ErkJggg==" alt="Vortex Debugger Logo" />
				</td>
			</tr>
        </table>
        <!-- Email Header : END -->
        
        <!-- Email Body : BEGIN -->
        <table cellspacing="0" cellpadding="0" border="0" align="center" bgcolor="#EEE" width="600" style="margin: auto;" class="email-container">
            
            <!-- 1 Column Text : BEGIN -->
            <tr>
                <td style="padding: 40px; text-align: center; font-family: sans-serif; font-size: 15px; mso-height-rule: exactly; line-height: 20px; color: #555555;">
                    You have been invited to create an account on a Vortex Debugger installation.
                    To continue, click the button below.
                    <br><br>
                    <!-- Button : Begin -->
                    <table cellspacing="0" cellpadding="0" border="0" align="center" style="Margin: auto">
                        <tr>
                            <td style="background: rgba(0, 0, 0, 0.2); padding: 10px;border-bottom: 3px solid #59c203;text-align: center;" class="button-td">
                                <a href="<?php echo $join_url ?>" style="color: #333;font-weight: bold; text-decoration: none">
                                    &nbsp;&nbsp;&nbsp;&nbsp;<span style="color:#ffffff">Create account</span>&nbsp;&nbsp;&nbsp;&nbsp;
                                </a>
                            </td>
                        </tr>
                    </table>
                    <!-- Button : END -->
                </td>
            </tr>
            <!-- 1 Column Text : BEGIN -->
        </table>
        <!-- Email Body : END -->
          
        <!-- Email Footer : BEGIN -->
        <table cellspacing="0" cellpadding="0" border="0" align="center" width="600" style="margin: auto;" class="email-container">
            <tr>
                <td style="padding: 40px 10px;width: 100%;font-size: 12px; font-family: sans-serif; mso-height-rule: exactly; line-height:18px; text-align: center; color: #888888;">
                  If you do not wish to create an account at this time, disregard this email. 
                </td>
            </tr>
        </table>
        <!-- Email Footer : END -->

    </center>
</body>
</html>

